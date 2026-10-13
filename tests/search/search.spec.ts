import { searchRoutes } from '../../src/api/search-api';
import { appUrl } from '../../src/config/env';
import { searchData, searchFixtures, suggestionRule } from '../../src/data/search';
import { uiText } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';
import { answerSearchWith } from '../../src/support/controlled-responses';
import { requestBarrier } from '../../src/support/network';

// UI scenarios run against controlled search responses built from the real response shape (`src/data/search.ts`),
// so they do not depend on the shared Elasticsearch index (automation-analysis.md §3.5). TS-SRCH-08 uses the real one.
test.describe('US-010 Search for songs and artists', () => {
  test('TS-SRCH-01 suggestions need 2 characters and the typing pause', { tag: ['@critical'] }, async ({
    page,
    header,
  }) => {
    await answerSearchWith(page, searchFixtures.withArtistAndSong, 'an artist and a song');
    // A paused page clock drives the 300 ms typing pause, so "no request yet" is checked without waiting in real time.
    const start = new Date('2026-10-13T08:00:00Z');
    await page.clock.install({ time: start });
    const keywords: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === searchRoutes.search) keywords.push(url.searchParams.get('keyword') ?? '');
    });
    await page.goto('/');
    await expect(header.searchInput).toBeVisible();
    await page.clock.pauseAt(new Date(start.getTime() + 60_000));

    await test.step('1 character: no request, even after the pause', async () => {
      await header.typeSearch(searchData.artist.keyword.slice(0, 1));
      await page.clock.runFor(suggestionRule.debounceMs * 3);
      await requestBarrier(page);
      expect(keywords).toEqual([]);
    });

    await test.step('fast typing: no request before the pause ends', async () => {
      await header.typeSearch(searchData.artist.keyword.slice(1), { append: true });
      await page.clock.runFor(suggestionRule.debounceMs - 1);
      await requestBarrier(page);
      expect(keywords).toEqual([]);
    });

    await test.step('one request for the final text once the pause ends', async () => {
      const request = page.waitForRequest((r) => new URL(r.url()).pathname === searchRoutes.search);
      await page.clock.runFor(1);
      await request;
      await requestBarrier(page);
      expect(keywords).toEqual([searchData.artist.keyword]);
      await expect(header.suggestions.first()).toBeVisible();
    });
  });

  test('TS-SRCH-03 navigation from suggestions and Enter', { tag: ['@critical'] }, async ({
    page,
    header,
    artistPage,
    songPage,
    searchResultsPage,
  }) => {
    await answerSearchWith(page, searchFixtures.withArtistAndSong, 'artist 27 as top result and song 1');
    await page.goto('/');

    await test.step('an artist suggestion opens the artist page', async () => {
      await header.typeSearch(searchData.artist.keyword);
      await expect(header.suggestions).toHaveCount(2);
      await header.chooseSuggestion(searchData.artist.name);
      await expect(page).toHaveURL(appUrl(`/artist/${searchData.artist.id}`));
      await expect(artistPage.name).toHaveText(searchData.artist.name);
    });

    await test.step('a song suggestion opens the song page', async () => {
      await header.typeSearch(searchData.song.keyword);
      await header.chooseSuggestion(searchData.song.name);
      await expect(page).toHaveURL(appUrl(`/song/${searchData.song.id}`));
      await expect(songPage.title).toHaveText(searchData.song.name);
    });

    await test.step('Enter searches for the trimmed text', async () => {
      await header.searchInput.fill(searchData.paddedKeyword);
      await header.submitSearch();
      await expect(searchResultsPage.heading).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/search');
      expect(new URL(page.url()).searchParams.get('q')).toBe(searchData.paddedKeyword.trim());
    });

    await test.step('Enter with only spaces stays on the page', async () => {
      const before = page.url();
      await header.searchInput.fill('   ');
      await header.submitSearch();
      await requestBarrier(page);
      expect(page.url()).toBe(before);
    });
  });

  test('TS-SRCH-05 a search without match is reported', { tag: ['@critical'] }, async ({
    page,
    header,
    searchResultsPage,
  }) => {
    await answerSearchWith(page, searchFixtures.empty, 'the empty result');
    await page.goto('/');

    await header.searchInput.fill(searchData.noMatch);
    await header.submitSearch();

    await expect(searchResultsPage.heading).toBeVisible();
    await expect(searchResultsPage.noResultsMessage(searchData.noMatch)).toBeVisible();
    await expect(searchResultsPage.topResultSection).toHaveCount(0);
  });

  test('TS-SRCH-08 real search finds indexed songs and artists', { tag: ['@sit-live'] }, async ({
    searchApi,
    searchResultsPage,
  }) => {
    const preflight = await searchApi.searchOrThrow(searchData.artist.keyword);
    test.skip(
      preflight.topResult === null && preflight.results.length === 0,
      'External unavailable: the search index returned nothing for a known artist (Elasticsearch empty or down).',
    );

    await test.step('API: exact names are the top result, in any case', async () => {
      for (const keyword of [searchData.artist.keyword, searchData.artist.keyword.toUpperCase()]) {
        const { topResult } = await searchApi.searchOrThrow(keyword);
        expect(topResult, `top result for "${keyword}"`).toMatchObject({ type: 'artist', id: searchData.artist.id });
      }
      expect((await searchApi.searchOrThrow(searchData.song.keyword)).topResult).toMatchObject({
        type: 'song',
        id: searchData.song.id,
        name: searchData.song.name,
      });
      expect((await searchApi.searchOrThrow(searchData.artistWithDiacritics.keyword)).topResult).toMatchObject({
        type: 'artist',
        id: searchData.artistWithDiacritics.id,
      });
    });

    await test.step('API: a partial name finds the item, not as top result', async () => {
      const partialSong = await searchApi.searchOrThrow(searchData.song.keyword.split(' ').slice(0, 2).join(' '));
      expect(partialSong.topResult).toBeNull();
      expect(partialSong.results.map((item) => `${item.type}:${item.id}`)).toContain(`song:${searchData.song.id}`);
      const partialArtist = await searchApi.searchOrThrow(searchData.artist.keyword.slice(0, 3));
      expect(partialArtist.results.map((item) => `${item.type}:${item.id}`)).toContain(`artist:${searchData.artist.id}`);
    });

    await test.step('UI: the results page shows the exact match as Top result', async () => {
      await searchResultsPage.open(searchData.song.keyword);
      await expect(searchResultsPage.topResultSection).toBeVisible();
      await expect(searchResultsPage.topResultSection).toContainText(searchData.song.name);
      await expect(searchResultsPage.heading).toHaveText(uiText.searchResults);
    });
  });
});
