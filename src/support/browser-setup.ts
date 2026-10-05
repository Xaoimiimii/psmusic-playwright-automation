import type { BrowserContext } from '@playwright/test';

/**
 * Recommendation tracker hosts aborted in every system-level UI test
 * (`docs/test-strategy/levels/system.md` §4, Mode 0). The loader is the
 * `<script>` in the client's `index.html`; the module host serves the banner,
 * popup and recommendations.
 */
const TRACKER_URLS = [
  'https://tracking-sdk.s3-ap-southeast-2.amazonaws.com/**',
  /^https:\/\/recsys-tracker-module-[^/]+\.onrender\.com\//,
];

export async function blockRecommendationTracker(context: BrowserContext): Promise<void> {
  for (const url of TRACKER_URLS) {
    await context.route(url, (route) => route.abort());
  }
}

/** Pins the UI language before the SPA boots (i18next reads `localStorage.i18nextLng`). */
export async function pinLanguage(context: BrowserContext, language = 'en'): Promise<void> {
  await context.addInitScript((lng) => window.localStorage.setItem('i18nextLng', lng), language);
}
