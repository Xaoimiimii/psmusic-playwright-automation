import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import { AuthApi } from '../api/auth-api';
import { SongApi } from '../api/song-api';
import { UserApi } from '../api/user-api';
import { buildUser, type NewUser } from '../data/users';
import { AuthPage } from '../pages/auth.page';
import { Header } from '../pages/components/header';
import { PlayerBar } from '../pages/components/player-bar';
import { Sidebar } from '../pages/components/sidebar';
import { SignInPrompt } from '../pages/components/sign-in-prompt';
import { FavoritesPage } from '../pages/favorites.page';
import { RecentPage } from '../pages/recent.page';
import { SongPage } from '../pages/song.page';
import { blockRecommendationTracker, pinLanguage } from '../support/browser-setup';
import { ApiTrafficLog } from '../support/network';
import { signInThroughApi } from '../support/session';
import { xrayTestKeyFor } from '../support/xray';

interface Fixtures {
  /** API client on its own cookie jar (no browser). */
  authApi: AuthApi;
  /** Song API client on its own request context (no browser, no cookies). */
  songApi: SongApi;
  /** User API client on its own request context (no browser, no cookies). */
  userApi: UserApi;
  /** A fresh run-unique account registered through the API; not signed in anywhere. */
  registeredUser: NewUser;
  /** A second fresh account, for scenarios about one user reaching another's data. */
  otherRegisteredUser: NewUser;
  /** A fresh account whose session is already in the browser context (refresh cookie set, no page loaded yet). */
  member: NewUser;
  apiTraffic: ApiTrafficLog;
  authPage: AuthPage;
  header: Header;
  sidebar: Sidebar;
  signInPrompt: SignInPrompt;
  playerBar: PlayerBar;
  favoritesPage: FavoritesPage;
  recentPage: RecentPage;
  songPage: SongPage;
  /** Automatic: annotates the test with its Xray `test_key` for the JUnit report (scripts/test-management/export-test-keys.mjs). */
  xrayTestKey: void;
}

/** Registers a run-unique account on a throwaway context, so its cookie jar never leaks into the test. */
async function registerFreshUser(): Promise<NewUser> {
  const setupContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  const user = buildUser();
  await new AuthApi(setupContext).registerOrThrow(user);
  await setupContext.dispose();
  return user;
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

  userApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new UserApi(requestContext));
    await requestContext.dispose();
  },

  registeredUser: async ({}, use) => use(await registerFreshUser()),
  otherRegisteredUser: async ({}, use) => use(await registerFreshUser()),

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
  signInPrompt: async ({ page }, use) => use(new SignInPrompt(page)),
  playerBar: async ({ page }, use) => use(new PlayerBar(page)),
  favoritesPage: async ({ page }, use) => use(new FavoritesPage(page)),
  recentPage: async ({ page }, use) => use(new RecentPage(page)),
  songPage: async ({ page }, use) => use(new SongPage(page)),

  // The JUnit reporter turns annotations into <property> elements; Xray attaches the result to this Test key.
  xrayTestKey: [
    async ({}, use, testInfo) => {
      const key = xrayTestKeyFor(testInfo.titlePath);
      if (key) testInfo.annotations.push({ type: 'test_key', description: key });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
