import type { BrowserContext, Cookie, Page } from '@playwright/test';
import { AuthApi } from '../api/auth-api';
import type { Credentials } from '../data/users';

/** HttpOnly session cookie set by login and refresh (`AuthController.SetRefreshTokenCookie`). */
export const REFRESH_COOKIE = 'RefreshToken';

/** Refresh token and cookie lifetime: `Jwt:RefreshExpiryMinutes` default 10080 and `Expires = +7 days`. */
export const REFRESH_LIFETIME_S = 7 * 24 * 60 * 60;

/** Slack for clock skew and request time when checking an expiry against "now + lifetime". */
export const EXPIRY_TOLERANCE_S = 5 * 60;

/**
 * Signs the browser context in without the UI: logs in through
 * `context.request`, which shares its cookie jar with the browser, so the
 * `RefreshToken` cookie is in place and the SPA restores the session through
 * `POST /api/auth/refresh` on the next page load.
 */
export async function signInThroughApi(context: BrowserContext, credentials: Credentials): Promise<void> {
  await new AuthApi(context.request).loginOrThrow(credentials);
}

export async function refreshCookie(context: BrowserContext): Promise<Cookie | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === REFRESH_COOKIE);
}

/**
 * Whether the browser holds the refresh cookie. Assert on this instead of on the
 * cookie itself, so a failure message never prints the token value.
 */
export async function hasRefreshCookie(context: BrowserContext): Promise<boolean> {
  return (await refreshCookie(context)) !== undefined;
}

/** The cookie without its value, for assertions whose failure output is uploaded by CI. */
export function cookieAttributes(cookie: Cookie): Omit<Cookie, 'value'> {
  const { value: _value, ...attributes } = cookie;
  return attributes;
}

/** Replaces the value of the stored refresh cookie, keeping its attributes. */
export async function replaceRefreshCookieValue(context: BrowserContext, value: string): Promise<void> {
  const cookie = await refreshCookie(context);
  if (!cookie) throw new Error(`No ${REFRESH_COOKIE} cookie to replace`);
  await context.addCookies([{ ...cookie, value }]);
}

/** Every value the page script can read from storage: localStorage, sessionStorage and `document.cookie`. */
export async function scriptReadableStorage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const dump = (storage: Storage) =>
      Object.keys(storage)
        .map((key) => `${key}=${storage.getItem(key)}`)
        .join('\n');
    return [dump(window.localStorage), dump(window.sessionStorage), document.cookie].join('\n');
  });
}
