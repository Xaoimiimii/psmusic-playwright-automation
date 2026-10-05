import { request } from '@playwright/test';
import { AuthApi } from './api/auth-api';
import { env } from './config/env';

/**
 * Reachability check before the suite (`docs/test-strategy/automation-analysis.md` §8).
 * Fails the run with one clear message instead of letting every test fail on a
 * connection error. The API probe is `POST /api/auth/refresh` without a cookie,
 * which answers 200 when the API is up and the service key is accepted.
 */
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const ui = await context.get(env.uiBaseUrl).catch((error: Error) => error);
    if (ui instanceof Error || !ui.ok()) {
      throw new Error(`PSMusic UI is not reachable at ${env.uiBaseUrl}: ${ui instanceof Error ? ui.message : ui.status()}`);
    }

    const api = await new AuthApi(context).refresh().catch((error: Error) => error);
    if (api instanceof Error) {
      throw new Error(`PSMusic API is not reachable at ${env.apiBaseUrl}: ${api.message}`);
    }
    if (api.status() === 401) {
      throw new Error('PSMusic API refused the service key (401). Check PSMUSIC_SERVICE_KEY in .env.');
    }
    if (!api.ok()) {
      throw new Error(`PSMusic API health probe returned ${api.status()} at ${env.apiBaseUrl}`);
    }
  } finally {
    await context.dispose();
  }
}
