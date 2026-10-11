import type { BrowserContext } from '@playwright/test';

/**
 * Recommendation tracker hosts aborted in every system-level UI test
 * (`docs/test-strategy/levels/system.md` §4, Mode 0). The loader is the
 * `<script>` in the client's `index.html`; the module host serves the banner,
 * popup and recommendations.
 */
const TRACKER_LOADER_ORIGIN = 'https://tracking-sdk.s3-ap-southeast-2.amazonaws.com/';
const TRACKER_MODULE_HOST = /^https:\/\/recsys-tracker-module-[^/]+\.onrender\.com\//;
const TRACKER_URLS = [`${TRACKER_LOADER_ORIGIN}**`, TRACKER_MODULE_HOST];

/** True for a URL the tracker block aborts; its "Failed to load resource" console error is expected. */
export function isRecommendationTrackerUrl(url: string): boolean {
  return url.startsWith(TRACKER_LOADER_ORIGIN) || TRACKER_MODULE_HOST.test(url);
}

export async function blockRecommendationTracker(context: BrowserContext): Promise<void> {
  for (const url of TRACKER_URLS) {
    await context.route(url, (route) => route.abort());
  }
}

/**
 * Pins the UI language before the SPA boots (i18next reads `localStorage.i18nextLng`).
 * Skipped on the initial `about:blank` document of each page, where reading
 * `localStorage` throws a SecurityError that would show up as a page error.
 */
export async function pinLanguage(context: BrowserContext, language = 'en'): Promise<void> {
  await context.addInitScript((lng) => {
    if (window.location.protocol.startsWith('http')) window.localStorage.setItem('i18nextLng', lng);
  }, language);
}
