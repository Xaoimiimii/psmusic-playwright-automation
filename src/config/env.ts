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
} as const;

/** Absolute SPA URL for a route, e.g. appUrl('/') for Home. */
export function appUrl(route: string): string {
  return new URL(route, env.uiBaseUrl).href;
}
