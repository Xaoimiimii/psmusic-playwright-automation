import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const env = {
  uiBaseUrl: required('PSMUSIC_UI_URL'),
  apiBaseUrl: required('PSMUSIC_API_URL'),
  serviceKey: required('PSMUSIC_SERVICE_KEY'),
  /** Optional. Jira site, e.g. https://<site>.atlassian.net; when set, Allure results link to their Jira issues. */
  jiraSiteUrl: process.env.ATLASSIAN_SITE_URL?.replace(/\/+$/, '') || undefined,
  /**
   * Optional. A PSMusic API response slower than this (ms) is recorded as a `slow-response` failure signal.
   * Default 4000: web-first assertions wait 5 s, so a slower response leaves the UI under a second to show its
   * result before the assertion gives up. A signal for triage, not a performance requirement.
   */
  slowResponseMs: Number(process.env.PSMUSIC_SLOW_RESPONSE_MS) || 4_000,
} as const;

/** Absolute SPA URL for a route, e.g. appUrl('/') for Home. */
export function appUrl(route: string): string {
  return new URL(route, env.uiBaseUrl).href;
}
