import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { AuthApi } from '../api/auth-api';
import { SearchApi } from '../api/search-api';
import { SongApi } from '../api/song-api';
import { UserApi } from '../api/user-api';
import { buildUser, type NewUser } from '../data/users';
import { ArtistPage } from '../pages/artist.page';
import { AuthPage } from '../pages/auth.page';
import { CategoryPage } from '../pages/category.page';
import { ChartsPage } from '../pages/charts.page';
import { Header } from '../pages/components/header';
import { PlayerBar } from '../pages/components/player-bar';
import { RatingModal } from '../pages/components/rating-modal';
import { Sidebar } from '../pages/components/sidebar';
import { SignInPrompt } from '../pages/components/sign-in-prompt';
import { FavoritesPage } from '../pages/favorites.page';
import { GenresPage } from '../pages/genres.page';
import { HomePage } from '../pages/home.page';
import { RecentPage } from '../pages/recent.page';
import { SearchResultsPage } from '../pages/search-results.page';
import { SongPage } from '../pages/song.page';
import { applyOutcomeMetadata, applyScenarioMetadata } from '../reporting/allure-metadata';
import { withApiReporting } from '../reporting/api-reporting';
import { BrowserEvidence } from '../reporting/browser-evidence';
import { recordLayer, resetTestObservations } from '../reporting/test-observations';
import { blockRecommendationTracker, pinLanguage } from '../support/browser-setup';
import { holdStreamRecording } from '../support/controlled-responses';
import { ApiTrafficLog } from '../support/network';
import { signInThroughApi } from '../support/session';
import { xrayTestKeyFor } from '../support/xray';

interface Options {
  /**
   * `blocked` (default, Mode 0): the recommendation tracker is aborted, as in every system-level test.
   * `live` (Mode B): the real tracker runs, for `@sit-privacy` tests only (`levels/system-integration.md` §3).
   */
  recommendationTracker: 'blocked' | 'live';
}

interface Fixtures {
  /** API client on its own cookie jar (no browser). */
  authApi: AuthApi;
  /** Song API client on its own request context (no browser, no cookies). */
  songApi: SongApi;
  /** Search API client on its own request context (no browser, no cookies). */
  searchApi: SearchApi;
  /** User API client on its own request context (no browser, no cookies). */
  userApi: UserApi;
  /** A fresh run-unique account registered through the API; not signed in anywhere. */
  registeredUser: NewUser;
  /** A second fresh account, for scenarios about one user reaching another's data. */
  otherRegisteredUser: NewUser;
  /** A fresh account whose session is already in the browser context (refresh cookie set, no page loaded yet). */
  member: NewUser;
  /** `member` whose stream requests are answered in the browser: for tests that play music as a member (TR-01). */
  listeningMember: NewUser;
  apiTraffic: ApiTrafficLog;
  authPage: AuthPage;
  header: Header;
  sidebar: Sidebar;
  signInPrompt: SignInPrompt;
  playerBar: PlayerBar;
  ratingModal: RatingModal;
  homePage: HomePage;
  categoryPage: CategoryPage;
  genresPage: GenresPage;
  chartsPage: ChartsPage;
  artistPage: ArtistPage;
  searchResultsPage: SearchResultsPage;
  favoritesPage: FavoritesPage;
  recentPage: RecentPage;
  songPage: SongPage;
  /** Automatic: annotates the test with its Xray `test_key` for the JUnit report (scripts/test-management/export-test-keys.mjs). */
  xrayTestKey: void;
  /** Automatic: Allure metadata from the scenario, and outcome labels once the test has run (docs/reporting.md). */
  reporting: void;
}

/** Registers a run-unique account on a throwaway context, so its cookie jar never leaks into the test. */
async function registerFreshUser(role: string): Promise<NewUser> {
  const user = buildUser();
  await base.step(`Precondition: register ${role} "${user.username}" through the API`, async () => {
    const setupContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await new AuthApi(withApiReporting(setupContext, { precondition: true })).registerOrThrow(user);
    await setupContext.dispose();
  });
  // Excluded from Allure history: the name is new on every run.
  await allure.parameter(role, user.username, { excluded: true });
  return user;
}

export const test = base.extend<Options & Fixtures>({
  recommendationTracker: ['blocked', { option: true }],

  // Every UI test: tracker blocked (Mode 0) unless the test opts in, and English pinned before the SPA boots.
  // Console, page errors and the page's API calls are attached if the test fails.
  context: async ({ context, recommendationTracker }, use, testInfo) => {
    recordLayer('UI');
    const evidence = new BrowserEvidence(context);
    if (recommendationTracker === 'blocked') await blockRecommendationTracker(context);
    await pinLanguage(context);
    await use(context);
    await evidence.attachIfFailed(testInfo);
  },

  // Raw requests (access-control tests) are reported like the API clients' calls.
  request: async ({ request }, use) => {
    await use(withApiReporting(request));
  },

  authApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new AuthApi(withApiReporting(requestContext)));
    await requestContext.dispose();
  },

  songApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new SongApi(withApiReporting(requestContext)));
    await requestContext.dispose();
  },

  searchApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new SearchApi(withApiReporting(requestContext)));
    await requestContext.dispose();
  },

  userApi: async ({}, use) => {
    const requestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    await use(new UserApi(withApiReporting(requestContext)));
    await requestContext.dispose();
  },

  registeredUser: async ({}, use) => use(await registerFreshUser('test user')),
  otherRegisteredUser: async ({}, use) => use(await registerFreshUser('second test user')),

  member: async ({ context, registeredUser }, use) => {
    await signInThroughApi(context, registeredUser);
    await use(registeredUser);
  },

  listeningMember: async ({ page, member }, use) => {
    await holdStreamRecording(page);
    await use(member);
  },

  apiTraffic: async ({ page }, use) => {
    await use(new ApiTrafficLog(page));
  },

  authPage: async ({ page }, use) => use(new AuthPage(page)),
  header: async ({ page }, use) => use(new Header(page)),
  sidebar: async ({ page }, use) => use(new Sidebar(page)),
  signInPrompt: async ({ page }, use) => use(new SignInPrompt(page)),
  playerBar: async ({ page }, use) => use(new PlayerBar(page)),
  ratingModal: async ({ page }, use) => use(new RatingModal(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  categoryPage: async ({ page }, use) => use(new CategoryPage(page)),
  genresPage: async ({ page }, use) => use(new GenresPage(page)),
  chartsPage: async ({ page }, use) => use(new ChartsPage(page)),
  artistPage: async ({ page }, use) => use(new ArtistPage(page)),
  searchResultsPage: async ({ page }, use) => use(new SearchResultsPage(page)),
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

  reporting: [
    async ({}, use, testInfo) => {
      resetTestObservations();
      await applyScenarioMetadata(testInfo);
      await use();
      await applyOutcomeMetadata(testInfo);
    },
    { auto: true },
  ],
});

export { expect };
