import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';

/**
 * The live recommendation tracker (third party, Mode B in `levels/system-integration.md` §3): its loader comes from
 * the S3 host in the client's `index.html`, its configuration, recommendations and behavior events from the module
 * host (`docs/exploration/browser/recommendations.md` §8.7). Only `@sit-privacy` tests let it run.
 */
const TRACKER_MODULE_HOST = /^recsys-tracker-module-[^.]+\.onrender\.com$/;

/** Time the free-tier module host gets to answer the first configuration request (cold start). */
export const TRACKER_START_TIMEOUT_MS = 30_000;

/**
 * Stores "Accept all" before the SPA boots (`localStorage.recsys_consent_status`, the value the banner's
 * Accept all writes). Since 2026-10-12 the tracker no longer shows its consent banner on a first visit, so consent
 * cannot be given through the UI (`docs/exploration/browser/recommendations.md` §9).
 */
export async function grantRecommendationConsent(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (window.location.protocol.startsWith('http')) window.localStorage.setItem('recsys_consent_status', 'granted');
  });
}

function isTrackerRequest(request: Request): boolean {
  return TRACKER_MODULE_HOST.test(new URL(request.url()).host);
}

/**
 * Requests the page sends to the tracker module host. Behavior events (`POST /event`) are sent with
 * `navigator.sendBeacon`; Playwright still reports them as requests, without a readable body.
 */
export class TrackerTraffic {
  private readonly requests: Request[] = [];

  constructor(page: Page) {
    page.on('request', (request) => {
      if (isTrackerRequest(request)) this.requests.push(request);
    });
  }

  mark(): number {
    return this.requests.length;
  }

  /** `POST /event` requests (behavior: click, rating, review) sent after position `from`. */
  events(from = 0): Request[] {
    return this.requests.slice(from).filter((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/event');
  }
}

/**
 * Preflight on the first page of a fresh browser: waits for the tracker to load its rules and to store its anonymous
 * identity (`localStorage.recsys_anon_id`). On that first load it requests no recommendations; it does so from the
 * next page load on (`docs/exploration/browser/recommendations.md` §8.1, §9 R-9.5), so the test starts browsing after
 * this. If the third-party host does not answer, the test is skipped as "external unavailable" rather than failed:
 * the outage is not a PSMusic defect.
 */
export async function expectTrackerAvailable(page: Page, load: () => Promise<unknown>): Promise<void> {
  const rulesLoaded = page
    .waitForResponse((response) => isTrackerRequest(response.request()) && new URL(response.url()).pathname.startsWith('/rule/domain/'), {
      timeout: TRACKER_START_TIMEOUT_MS,
    })
    .then((response) => response.ok())
    .catch(() => false);
  await load();
  test.skip(!(await rulesLoaded), 'External unavailable: the recommendation tracker did not load its rules (third-party outage).');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('recsys_anon_id') !== null), {
      message: 'tracker stored its anonymous identity',
      timeout: TRACKER_START_TIMEOUT_MS,
    })
    .toBe(true);
}
