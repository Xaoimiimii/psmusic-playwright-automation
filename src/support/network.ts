import type { Page, Request, Response } from '@playwright/test';
import { env } from '../config/env';

/** True when the request is `method` on the PSMusic API path `route` (query string ignored). */
export function isApiRequest(request: Request, method: string, route: string): boolean {
  const url = new URL(request.url());
  return request.method() === method && url.origin === new URL(env.apiBaseUrl).origin && url.pathname === route;
}

/**
 * Response to the next `method route` request the page sends after this call.
 * Unlike `page.waitForResponse`, a request already in flight is ignored: the
 * dev build sends `auth/refresh` twice per load, and the second can still be
 * pending when the page looks ready. Call it before the action that triggers
 * the request, await it after.
 */
export async function nextApiResponse(page: Page, method: string, route: string): Promise<Response> {
  const request = await page.waitForRequest((r) => isApiRequest(r, method, route));
  const response = await request.response();
  if (!response) throw new Error(`${method} ${route} failed without a response: ${request.failure()?.errorText}`);
  return response;
}

/**
 * Id of the next song the player loads (`GET /api/song/{id}/player`) after this call. Call it before the action that
 * changes the song, await it after: the test then compares the id instead of timing out on a wrong song.
 */
export async function nextPlayerSongId(page: Page): Promise<number> {
  const apiOrigin = new URL(env.apiBaseUrl).origin;
  const request = await page.waitForRequest((r) => {
    const url = new URL(r.url());
    return r.method() === 'GET' && url.origin === apiOrigin && PLAYER_PATH.test(url.pathname);
  });
  return Number(new URL(request.url()).pathname.match(PLAYER_PATH)![1]);
}

/**
 * Returns once a marker request, sent by the page after this call, has been seen.
 * The browser reports requests in the order they are issued, so a request
 * triggered by an earlier click is already reported when this returns. Used to
 * prove "no request was sent" without a fixed wait.
 */
export async function requestBarrier(page: Page): Promise<void> {
  const marker = `/__barrier__/${Date.now()}`;
  const seen = page.waitForRequest((request) => new URL(request.url()).pathname === marker);
  await page.evaluate((path) => {
    void fetch(path).catch(() => undefined);
  }, marker);
  await seen;
}

const PLAYER_PATH = /^\/api\/song\/(\d+)\/player$/;

export interface ApiCall {
  method: string;
  path: string;
  authorization?: string;
  /** Set once the response arrives (fulfilled responses included). */
  status?: number;
}

/**
 * PSMusic API calls made by a page, in the order they were issued, each with
 * its response status once known. Used where a scenario is about the sequence
 * of calls (no request sent, one refresh then a retry) rather than one response.
 */
export class ApiTrafficLog {
  readonly calls: ApiCall[] = [];

  constructor(page: Page) {
    const apiOrigin = new URL(env.apiBaseUrl).origin;
    const byRequest = new Map<Request, ApiCall>();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== apiOrigin) return;
      const call: ApiCall = { method: request.method(), path: url.pathname, authorization: request.headers()['authorization'] };
      byRequest.set(request, call);
      this.calls.push(call);
    });
    page.on('response', (response) => {
      const call = byRequest.get(response.request());
      if (call) call.status = response.status();
    });
  }

  /** Position to pass to `after()`, so earlier traffic (page load) can be ignored. */
  mark(): number {
    return this.calls.length;
  }

  /** Calls to `method route` issued after position `from` (an index from `mark()` or `indexOf`). */
  after(from: number, method: string, route: string): ApiCall[] {
    return this.calls.slice(from).filter((call) => call.method === method && call.path === route);
  }

  indexOf(call: ApiCall): number {
    return this.calls.indexOf(call);
  }

  /**
   * Songs the player loaded after position `from`, in order: one `GET /api/song/{id}/player` per song change
   * (only `PlayerControlService` calls it). The dev build may send the same GET twice in a row, so repeats of the
   * same id next to each other count once.
   */
  playerSongIds(from = 0): number[] {
    const ids: number[] = [];
    for (const call of this.calls.slice(from)) {
      const id = call.method === 'GET' ? Number(call.path.match(PLAYER_PATH)?.[1]) : NaN;
      if (Number.isInteger(id) && ids.at(-1) !== id) ids.push(id);
    }
    return ids;
  }

  /** Number of `method route` calls sent but not answered yet. */
  inFlight(method: string, route: string): number {
    return this.after(0, method, route).filter((call) => call.status === undefined).length;
  }
}
