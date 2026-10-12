import type { BrowserContext, Page, Request, TestInfo } from '@playwright/test';
import { env } from '../config/env';
import { isRecommendationTrackerUrl } from '../support/browser-setup';
import { failureSignals, recordFailureSignal } from './test-observations';
import { redactText, truncate } from './redaction';

const MAX_CONSOLE_ENTRIES = 100;
const MAX_API_CALLS = 200;
const MAX_MESSAGE_LENGTH = 1_000;

interface BrowserApiCall {
  method: string;
  path: string;
  startedAt: number;
  status?: number;
  durationMs?: number;
  failure?: string;
}

/**
 * Collects, for one browser context, what explains a UI failure beyond the
 * screenshot and the accessibility snapshot Playwright already attaches:
 * console errors and warnings, uncaught page errors, and every PSMusic API call
 * the pages made with its status. Attached only when the test does not end as
 * expected, so passing tests carry no extra evidence.
 */
export class BrowserEvidence {
  private readonly consoleEntries: string[] = [];
  private readonly pageErrors: string[] = [];
  private readonly apiCalls: BrowserApiCall[] = [];

  constructor(private readonly context: BrowserContext) {
    const apiOrigin = new URL(env.apiBaseUrl).origin;
    const byRequest = new Map<Request, BrowserApiCall>();

    context.on('console', (message) => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      const { url, lineNumber } = message.location();
      // The tracker is aborted on purpose (browser-setup.ts); its load error says nothing about the failure.
      if (isRecommendationTrackerUrl(url)) return;
      const where = url ? ` (${url}:${lineNumber})` : '';
      this.keepLast(this.consoleEntries, `[${message.type()}] ${message.text()}${where}`, MAX_CONSOLE_ENTRIES);
    });
    context.on('weberror', (webError) => {
      const error = webError.error();
      this.pageErrors.push(`${error.name}: ${error.message}`);
      recordFailureSignal('page-error', `${error.name}: ${error.message.split('\n')[0]}`);
    });
    context.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== apiOrigin) return;
      const call: BrowserApiCall = { method: request.method(), path: url.pathname, startedAt: Date.now() };
      byRequest.set(request, call);
      this.keepLast(this.apiCalls, call, MAX_API_CALLS);
    });
    context.on('response', (response) => {
      const call = byRequest.get(response.request());
      if (!call) return;
      call.status = response.status();
      call.durationMs = Date.now() - call.startedAt;
      if (call.status >= 500) recordFailureSignal('backend-5xx', `browser: ${call.method} ${call.path} -> ${call.status}`);
      if (call.durationMs >= env.slowResponseMs) {
        recordFailureSignal('slow-response', `browser: ${call.method} ${call.path} -> ${call.status} in ${call.durationMs} ms`);
      }
    });
    context.on('requestfailed', (request) => {
      const call = byRequest.get(request);
      if (!call) return;
      call.failure = request.failure()?.errorText ?? 'failed';
      // ERR_ABORTED is the SPA cancelling its own request on navigation, not a network problem.
      if (!call.failure.includes('ERR_ABORTED')) recordFailureSignal('network-error', `browser: ${call.method} ${call.path}: ${call.failure}`);
    });
  }

  /**
   * Attaches the collected evidence when the test did not end as expected. Never
   * throws: evidence collection must not replace or hide the original failure.
   */
  async attachIfFailed(testInfo: TestInfo): Promise<void> {
    if (testInfo.status === testInfo.expectedStatus) return;
    this.recordPendingSlowCalls();
    try {
      await testInfo.attach('Failure context', { body: await this.failureContext(), contentType: 'text/plain' });
      if (this.apiCalls.length > 0) {
        await testInfo.attach('Browser API traffic', { body: this.apiTraffic(), contentType: 'text/plain' });
      }
    } catch (error) {
      await testInfo
        .attach('Failure context (incomplete)', { body: `Evidence collection failed: ${(error as Error).message}`, contentType: 'text/plain' })
        .catch(() => undefined);
    }
  }

  private async failureContext(): Promise<string> {
    const pages = this.context.pages();
    const lines = ['Pages open at the end of the test'];
    if (pages.length === 0) lines.push('  (none)');
    for (const [index, page] of pages.entries()) {
      lines.push(`  ${index + 1}. ${redactText(page.url())}  title: "${await titleOf(page)}"`);
    }
    const browser = this.context.browser();
    const viewport = pages[0]?.viewportSize();
    lines.push(
      '',
      `Browser: ${browser ? `${browser.browserType().name()} ${browser.version()}` : 'unknown'}` +
        (viewport ? `, viewport ${viewport.width}x${viewport.height}` : ''),
    );

    const signals = [...failureSignals()].flatMap(([signal, details]) => details.map((detail) => `  ${signal}: ${detail}`));
    lines.push('', `Failure signals (${signals.length})`, ...(signals.length ? signals : ['  none observed']));
    lines.push('', `Uncaught page errors (${this.pageErrors.length})`, ...this.indented(this.pageErrors));
    lines.push('', `Console errors and warnings (${this.consoleEntries.length})`, ...this.indented(this.consoleEntries));
    return lines.join('\n');
  }

  /**
   * A call still unanswered when the test failed (e.g. a login still loading when the assertion timed out) is
   * the slow response that matters most, and the 'response' event never fires for it.
   */
  private recordPendingSlowCalls(): void {
    const now = Date.now();
    for (const call of this.apiCalls) {
      if (call.status === undefined && !call.failure && now - call.startedAt >= env.slowResponseMs) {
        recordFailureSignal('slow-response', `browser: ${call.method} ${call.path} -> no response after ${now - call.startedAt} ms`);
      }
    }
  }

  private apiTraffic(): string {
    const header = `PSMusic API calls made by the browser, in the order sent (last ${MAX_API_CALLS} at most)`;
    const rows = this.apiCalls.map((call) => {
      const outcome = call.failure ? `FAILED (${call.failure})` : (call.status ?? 'no response yet');
      const duration = call.durationMs === undefined ? '' : ` ${call.durationMs} ms`;
      return `  ${call.method} ${call.path} -> ${outcome}${duration}`;
    });
    return [header, ...rows].join('\n');
  }

  private indented(entries: string[]): string[] {
    return entries.length === 0 ? ['  none'] : entries.map((entry) => `  ${truncate(redactText(entry), MAX_MESSAGE_LENGTH)}`);
  }

  private keepLast<T>(list: T[], item: T, max: number): void {
    list.push(item);
    if (list.length > max) list.shift();
  }
}

/** The page title, or a placeholder when the page is busy or closed; never waits more than 2 s. */
async function titleOf(page: Page): Promise<string> {
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('<title not available>'), 2_000));
  return Promise.race([page.title().catch(() => '<title not available>'), timeout]);
}
