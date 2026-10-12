// Jira Cloud REST client: the fallback channel for CI, where no MCP sign-in exists (capability-matrix.md).
// Contract: docs/integrations/jira-cloud-rest-api.md. Reads ATLASSIAN_SITE_URL, ATLASSIAN_CLOUD_ID, JIRA_USER_EMAIL,
// JIRA_API_TOKEN (loaded from .env by xray-client.mjs, or from the CI environment). Never prints the token.
import { redact } from './xray-client.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when every variable this client needs is set. */
export const jiraConfigured = () =>
  ['ATLASSIAN_SITE_URL', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN'].every((name) => process.env[name]);

/** Browser URL of an issue (always the site URL, whatever API base is used). */
export const browseUrl = (key) => `${process.env.ATLASSIAN_SITE_URL.replace(/\/+$/, '')}/browse/${key}`;

/** With a Cloud ID the api.atlassian.com form works for classic and scoped tokens alike (jira-cloud-rest-api.md §1). */
function apiBase() {
  const { ATLASSIAN_CLOUD_ID: cloudId, ATLASSIAN_SITE_URL: site } = process.env;
  return cloudId ? `https://api.atlassian.com/ex/jira/${cloudId}` : site.replace(/\/+$/, '');
}

/**
 * One REST call. `retry` only for idempotent calls: 429/5xx are retried with backoff (max 4 attempts).
 * Returns the parsed JSON body, or null for an empty body.
 */
export async function jira(method, path, body, { retry = false } = {}) {
  if (!jiraConfigured()) throw new Error('ATLASSIAN_SITE_URL / JIRA_USER_EMAIL / JIRA_API_TOKEN are not set');
  const auth = Buffer.from(`${process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    if (retry && (response.status === 429 || response.status >= 500) && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep((retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000) + Math.random() * 500);
      continue;
    }
    if (!response.ok) throw new Error(`jira ${method} ${path}: HTTP ${response.status} ${redact(text).slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }
}

/** POST /rest/api/3/search/jql (the old /search is being removed). First page only: callers use narrow JQL. */
export async function searchIssues(jql, fields = ['summary']) {
  const result = await jira('POST', '/rest/api/3/search/jql', { jql, fields, maxResults: 50 }, { retry: true });
  return result.issues ?? [];
}

export const getIssue = (key, fields) =>
  jira('GET', `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields.join(',')}`, null, { retry: true });

/** The issue's Web links (remote links), each `{ id, globalId?, relationship, object: { url, title, summary } }`. */
export const getRemoteLinks = (key) => jira('GET', `/rest/api/3/issue/${encodeURIComponent(key)}/remotelink`, null, { retry: true });

/**
 * Creates an issue through REST v2, whose `description` is a wiki-markup string (v3 would need ADF; see
 * jira-cloud-rest-api.md §1). Never retried: a timed-out create may have succeeded, so callers search first.
 * Returns { id, key, self }.
 */
export const createIssue = (fields) => jira('POST', '/rest/api/2/issue', { fields });

/** Issue link, e.g. ("Relates", "MSC-1", "MSC-2"). Not retried; callers read the links back. */
export const createIssueLink = (type, inwardKey, outwardKey) =>
  jira('POST', '/rest/api/3/issueLink', { type: { name: type }, inwardIssue: { key: inwardKey }, outwardIssue: { key: outwardKey } });

/**
 * Creates a Web link, or updates the one with the same `globalId` on this issue (Jira's documented behavior for
 * POST remotelink), so a repeated call never adds a second link. Safe to retry for that reason.
 */
export const upsertRemoteLink = (key, link) =>
  jira('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/remotelink`, link, { retry: true });
