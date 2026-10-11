// Xray Cloud client: authentication, GraphQL with retry, redaction. Used by scripts/xray/xray.mjs (CLI) and
// scripts/test-management/sync-xray.mjs. Contract: docs/integrations/xray-cloud-rest-api.md.
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // Variables may come from the environment instead (CI).
}

const baseUrl = (process.env.XRAY_BASE_URL || 'https://xray.cloud.getxray.app').replace(/\/+$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Removes anything that looks like a bearer token or the client secret from a message. */
export function redact(text) {
  let out = String(text).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<redacted-token>');
  for (const secret of [process.env.XRAY_CLIENT_SECRET, process.env.XRAY_CLIENT_ID]) {
    if (secret) out = out.split(secret).join('<redacted>');
  }
  return out;
}

let token = null;
export async function authenticate() {
  const { XRAY_CLIENT_ID: client_id, XRAY_CLIENT_SECRET: client_secret } = process.env;
  if (!client_id || !client_secret) throw new Error('XRAY_CLIENT_ID / XRAY_CLIENT_SECRET are not set');
  const response = await fetch(`${baseUrl}/api/v2/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, client_secret }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`authenticate: HTTP ${response.status} ${redact(body).slice(0, 300)}`);
  token = JSON.parse(body);
}

/**
 * POST /api/v2/graphql. `retry` only for idempotent calls (reads, add-to-container): 429/5xx are retried with
 * backoff (max 4 attempts); 401 re-authenticates once.
 */
export async function graphql(query, variables = {}, { retry = false } = {}) {
  if (!token) await authenticate();
  let reauthenticated = false;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${baseUrl}/api/v2/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
    });
    const text = await response.text();
    if (response.status === 401 && !reauthenticated) {
      reauthenticated = true;
      await authenticate();
      continue;
    }
    if (retry && (response.status === 429 || response.status >= 500) && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep((retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000) + Math.random() * 500);
      continue;
    }
    if (!response.ok) throw new Error(`graphql: HTTP ${response.status} ${redact(text).slice(0, 500)}`);
    const body = JSON.parse(text);
    if (body.errors?.length) throw new Error(`graphql errors: ${redact(JSON.stringify(body.errors)).slice(0, 1000)}`);
    return body.data;
  }
}


/**
 * POST /api/v2/import/execution/junit (xray-cloud-rest-api.md §6.1). Creates a Test Execution, or updates
 * `testExecKey`, and returns `{ id, key, self }`. Never retried: an import that timed out may have succeeded, so
 * search for the execution first.
 */
export async function importJunit(xml, { projectKey, testPlanKey, testExecKey } = {}) {
  if (!token) await authenticate();
  const query = new URLSearchParams(Object.entries({ projectKey, testPlanKey, testExecKey }).filter(([, v]) => v));
  const response = await fetch(`${baseUrl}/api/v2/import/execution/junit?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', Authorization: `Bearer ${token}` },
    body: xml,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`import junit: HTTP ${response.status} ${redact(text).slice(0, 1000)}`);
  return JSON.parse(text);
}
