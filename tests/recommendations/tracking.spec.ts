import { catalog } from '../../src/data/catalog';
import { test, expect } from '../../src/fixtures/test';
import {
  expectTrackerAvailable,
  grantRecommendationConsent,
  TRACKER_START_TIMEOUT_MS,
  TrackerTraffic,
} from '../../src/support/recommendation-tracker';
import { nextPlayerSongId, requestBarrier } from '../../src/support/network';

/** Main pages a visitor browses. Each one runs the tracker (inline section or popup, `recommendations.md` §8.1). */
const mainPages = [
  { name: 'Home', path: '/' },
  { name: 'song page', path: `/song/${catalog.songWithMedia}` },
  { name: 'genre page', path: `/category/${catalog.genreWithSongs}` },
  { name: 'Genres & Topics', path: '/genres' },
  { name: 'Charts', path: '/charts' },
];

// Mode B: the real third-party tracker, capture only. A guest with consent granted, a fresh browser per test.
test.describe('US-022 Receive "Recommended for you" recommendations', () => {
  test.use({ recommendationTracker: 'live' });

  test('TS-REC-12 no behavior is sent without interaction', { tag: ['@sit-privacy'] }, async ({
    page,
    context,
    genresPage,
  }) => {
    await grantRecommendationConsent(context);
    const tracker = new TrackerTraffic(page);
    const recommendationCards = page.locator('.recsys-item');
    await expectTrackerAvailable(page, () => page.goto('/'));

    for (const { name, path } of mainPages) {
      await test.step(`browse ${name} and scroll to the bottom without clicking`, async () => {
        await page.goto(path);
        // Cards rendered = the tracker is running on this page, so silence below is not an outage.
        await expect(recommendationCards.first()).toBeVisible({ timeout: TRACKER_START_TIMEOUT_MS });
        await page.mouse.wheel(0, 10_000);
      });
    }

    await test.step('no behavior event was sent', async () => {
      await requestBarrier(page);
      expect(tracker.events().map((request) => request.url()), 'POST /event while only browsing').toEqual([]);
    });

    await test.step('control: a song-card click is captured as an event', async () => {
      // Proves the capture would have seen an event: without it, "no event" could mean "nothing captured".
      await genresPage.open();
      // A page load restarts the tracker: click only once it runs again (its popup cards are rendered).
      await expect(recommendationCards.first()).toBeVisible({ timeout: TRACKER_START_TIMEOUT_MS });
      const mark = tracker.mark();
      const songLoaded = nextPlayerSongId(page);
      await genresPage.playFirstSongCard();
      await songLoaded;
      await expect
        .poll(() => tracker.events(mark).length, { message: 'event for the song-card click', timeout: 15_000 })
        .toBeGreaterThan(0);
    });
  });
});
