import type { APIResponse, Page } from '@playwright/test';
import { authBody, authRoutes } from '../../src/api/auth-api';
import { appUrl, env } from '../../src/config/env';
import { test, expect } from '../../src/fixtures/test';
import { serverMessage } from '../../src/data/messages';
import { isApiRequest, nextApiResponse } from '../../src/support/network';
import { knownDefect } from '../../src/support/known-defect';
import { decodeJwtPayload, type RefreshTokenClaims } from '../../src/support/jwt';
import {
  EXPIRY_TOLERANCE_S,
  REFRESH_COOKIE,
  REFRESH_LIFETIME_S,
  refreshCookie,
  replaceRefreshCookieValue,
} from '../../src/support/session';
import { setCookies } from '../../src/support/set-cookie';

/** Protected endpoint behind `/favorites` (`FavoriteSongsPage.jsx`). */
const FAVORITES_ROUTE = '/api/song/favorites';

test.describe('US-003 Stay signed in', () => {
  test('TS-AUTH-05 reload restores the session', { tag: ['@smoke', '@critical'] }, async ({
    page,
    header,
    favoritesPage,
    member,
  }) => {
    await page.goto('/');
    await expect(header.userMenuButton).toBeVisible();

    await test.step('reload a public page', async () => {
      const refreshResponse = nextApiResponse(page, 'POST', authRoutes.refresh);
      await page.reload();
      const body = await authBody(await refreshResponse);
      expect(body).toMatchObject({ isSuccess: true, token: expect.any(String), user: { username: member.username } });
      await expect(header.userMenuButton).toBeVisible();
      await expect(header.loginButton).toBeHidden();
    });

    await test.step('reload a protected page', async () => {
      await favoritesPage.open();
      await expect(favoritesPage.content).toBeVisible();
      await page.reload();
      await expect(favoritesPage.content).toBeVisible();
      await expect(page).toHaveURL(appUrl(favoritesPage.path));
    });
  });

  test('TS-AUTH-06 no refresh cookie means guest', { tag: ['@critical'] }, async ({ page, authApi, header }) => {
    await test.step('API: refresh without a cookie fails with HTTP 200', async () => {
      const response = await authApi.refresh();
      expect(response.status()).toBe(200);
      const body = await authBody(response);
      expect(body.isSuccess).toBe(false);
      expect(body.token).toBeUndefined();
      expect(body.user).toBeUndefined();
    });

    await test.step('UI: Home shows the guest header', async () => {
      const refreshResponse = nextApiResponse(page, 'POST', authRoutes.refresh);
      await page.goto('/');
      expect((await authBody(await refreshResponse)).isSuccess).toBe(false);
      await expect(header.loginButton).toBeVisible();
      await expect(header.userMenuButton).toBeHidden();
    });
  });

  test('TS-AUTH-07 a 401 on a protected call triggers one refresh and a retry', {
    tag: ['@critical'],
    annotation: {
      type: 'controlled-response',
      description: 'The first GET /api/song/favorites is answered with 401 in the browser. Real token expiry is deferred to D-TOK (TR-09).',
    },
  }, async ({ page, header, sidebar, favoritesPage, apiTraffic, member }) => {
    await page.goto('/');
    await expect(header.userMenuButton).toBeVisible();
    await answerFirstCallWith401(page, FAVORITES_ROUTE);
    const start = apiTraffic.mark();

    await sidebar.openFavorites();

    await test.step('the 401 is followed by one refresh and a successful retry', async () => {
      // The dev build sends the favorites call twice (StrictMode), so the page can render from
      // the duplicate before the retry. Calls are ordered by issue time: the page-load refreshes
      // were issued before the first favorites call, the retry only after the refresh.
      const firstFavoritesCall = () => apiTraffic.after(start, 'GET', FAVORITES_ROUTE)[0];
      await expect.poll(() => firstFavoritesCall()?.status, { message: 'first favorites call answered' }).toBe(401);
      const firstCall = firstFavoritesCall();

      const retriedAfterRefresh = () => {
        const [refresh] = apiTraffic.after(apiTraffic.indexOf(firstCall), 'POST', authRoutes.refresh);
        return refresh ? apiTraffic.after(apiTraffic.indexOf(refresh), 'GET', FAVORITES_ROUTE).map((call) => call.status) : [];
      };
      await expect.poll(retriedAfterRefresh, { message: 'favorites retried after the refresh' }).toContain(200);

      const refreshes = apiTraffic.after(apiTraffic.indexOf(firstCall), 'POST', authRoutes.refresh);
      expect(refreshes.map((call) => call.status), 'exactly one refresh, and it succeeded').toEqual([200]);
    });

    await test.step('the user sees the page, still signed in, without an error', async () => {
      await expect(favoritesPage.content).toBeVisible();
      await expect(page).toHaveURL(appUrl(favoritesPage.path));
      await expect(header.userMenuButton).toBeVisible();
    });
  });

  test('TS-AUTH-08 a failed refresh logs the user out cleanly', {
    tag: ['@critical'],
    annotation: {
      type: 'controlled-response',
      description: 'The first GET /api/song/favorites is answered with 401 and the refresh cookie is replaced by an invalid value. Real expiry is deferred to D-TOK (TR-09).',
    },
  }, async ({ page, context, header, sidebar, apiTraffic, member }) => {
    await page.goto('/');
    await expect(header.userMenuButton).toBeVisible();
    // The dev build sends two page-load refreshes; a late one would overwrite the
    // invalid cookie with a valid one through Set-Cookie, so let them finish first.
    await expect.poll(() => apiTraffic.inFlight('POST', authRoutes.refresh), { message: 'page-load refreshes finished' }).toBe(0);
    await replaceRefreshCookieValue(context, 'invalid-refresh-token');
    await answerFirstCallWith401(page, FAVORITES_ROUTE);

    const refreshResponse = nextApiResponse(page, 'POST', authRoutes.refresh);
    await sidebar.openFavorites();

    await test.step('refresh is refused and the session is ended', async () => {
      expect((await authBody(await refreshResponse)).isSuccess).toBe(false);
      await expect.poll(() => refreshCookie(context), { message: 'refresh cookie removed by logout' }).toBeUndefined();
      await expect(header.userMenuButton).toBeHidden();
    });

    await test.step('the app lands on Home with the Login button', async () => {
      knownDefect('US-003-AC-05', 'after a failed refresh on /favorites the app lands on /auth instead of / (same redirect as US-004-AC-01)');
      await expect(page).toHaveURL(appUrl('/'));
      await expect(header.loginButton).toBeVisible();
    });
  });

  test('TS-AUTH-09 each refresh re-issues the refresh token', {
    tag: ['@critical', '@api'],
    annotation: [
      {
        type: 'pending-decision',
        description: 'Whether a previous refresh token stays usable is not asserted until U-2.4 is decided.',
      },
      {
        type: 'rule-clarified',
        description: 'A different token value per call is not required: tokens issued within the same second are identical (A-9, accepted 2026-10-05).',
      },
    ],
  }, async ({ authApi, registeredUser }) => {
    const login = await authApi.login(registeredUser);
    const userId = String((await authBody(login)).user!.id);
    let previous = issuedRefreshToken(login);
    expect(previous.sub, 'login issues a refresh token for the user').toBe(userId);

    for (const call of [1, 2]) {
      await test.step(`refresh #${call} accepts the last token and re-issues it with a renewed expiry`, async () => {
        // The request context sends the cookie set by the previous response, so success
        // here also proves the re-issued token is accepted.
        const response = await authApi.refresh();
        const body = await authBody(response);
        expect(body).toMatchObject({ isSuccess: true, message: serverMessage.refreshSuccess, user: { id: Number(userId) } });

        const token = issuedRefreshToken(response);
        expect(token).toMatchObject({ sub: userId, token_type: 'refresh' });
        expect(Math.abs(token.exp - Date.now() / 1000 - REFRESH_LIFETIME_S)).toBeLessThan(EXPIRY_TOLERANCE_S);
        expect(token.exp, 'expiry never moves backwards').toBeGreaterThanOrEqual(previous.exp);
        previous = token;
      });
    }
  });
});

/** Claims of the refresh token a login or refresh response sets as a cookie; fails if none is set. */
function issuedRefreshToken(response: APIResponse): RefreshTokenClaims {
  const [cookie] = setCookies(response, REFRESH_COOKIE);
  expect(cookie, `${REFRESH_COOKIE} cookie set`).toBeDefined();
  return decodeJwtPayload<RefreshTokenClaims>(cookie.value);
}

/**
 * Answers the first browser GET to the API route with 401 (empty body, like
 * the real `[Authorize]` rejection) and lets every later call through. The
 * API is cross-origin, so the fake response carries the CORS headers the real
 * API sends; without them the browser reports a network error, not a 401.
 */
async function answerFirstCallWith401(page: Page, route: string): Promise<void> {
  let answered = false;
  await page.route(
    (url) => url.pathname === route,
    async (intercepted) => {
      if (answered || !isApiRequest(intercepted.request(), 'GET', route)) return intercepted.fallback();
      answered = true;
      await intercepted.fulfill({
        status: 401,
        body: '',
        headers: {
          'access-control-allow-origin': new URL(env.uiBaseUrl).origin,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
}
