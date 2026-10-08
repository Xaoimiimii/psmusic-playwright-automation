import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import { AuthApi } from '../api/auth-api';
import { SongApi } from '../api/song-api';
import { buildUser, type NewUser } from '../data/users';
import { AuthPage } from '../pages/auth.page';
import { Header } from '../pages/components/header';
import { Sidebar } from '../pages/components/sidebar';
import { FavoritesPage } from '../pages/favorites.page';
import { SongPage } from '../pages/song.page';
import { blockRecommendationTracker, pinLanguage } from '../support/browser-setup';
import { ApiTrafficLog } from '../support/network';
import { signInThroughApi } from '../support/session';

interface Fixtures {
  /** API client on its own cookie jar (no browser). */
  authApi: AuthApi;
  /** Song API client on its own request context (no browser, no cookies). */
  songApi: SongApi;
  /** A fresh run-unique account registered through the API; not signed in anywhere. */
  registeredUser: NewUser;
  /** A fresh account whose session is already in the browser context (refresh cookie set, no page loaded yet). */
  member: NewUser;
  apiTraffic: ApiTrafficLog;
  authPage: AuthPage;
  header: Header;
  sidebar: Sidebar;
  favoritesPage: FavoritesPage;
  songPage: SongPage;
}

export const test = base.extend<Fixtures>({
  // Every UI test: tracker blocked (Mode 0) and English pinned before the SPA boots.
  context: async ({ context }, use) => {
    await blockRecommendationTracker(context);
    await pinLanguage(context);
    await use(context);
  },

  authApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new AuthApi(requestContext));
    await requestContext.dispose();
  },

  songApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new SongApi(requestContext));
    await requestContext.dispose();
  },

  registeredUser: async ({}, use) => {
    // Registration on a throwaway context so its cookie jar never leaks into the test.
    const setupContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    const user = buildUser();
    await new AuthApi(setupContext).registerOrThrow(user);
    await setupContext.dispose();
    await use(user);
  },

  member: async ({ context, registeredUser }, use) => {
    await signInThroughApi(context, registeredUser);
    await use(registeredUser);
  },

  apiTraffic: async ({ page }, use) => {
    await use(new ApiTrafficLog(page));
  },

  authPage: async ({ page }, use) => use(new AuthPage(page)),
  header: async ({ page }, use) => use(new Header(page)),
  sidebar: async ({ page }, use) => use(new Sidebar(page)),
  favoritesPage: async ({ page }, use) => use(new FavoritesPage(page)),
  songPage: async ({ page }, use) => use(new SongPage(page)),
});

export { expect };
