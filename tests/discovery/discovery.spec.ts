import { appUrl } from '../../src/config/env';
import { discoveryLimits, chartsFirst } from '../../src/data/discovery';
import { uiText } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';

// Home and Charts list what was played in the last 7 days, so their content depends on the environment's recent
// listening (TR-08). Counts are checked as "at most", and names are compared with the page they lead to.
test.describe('US-005 Home page', () => {
  test('TS-DISC-01 Home sections, limits and links', { tag: ['@regression'] }, async ({
    page,
    homePage,
    categoryPage,
    artistPage,
    chartsPage,
  }) => {
    await homePage.open();
    await expect(homePage.genreSectionHeading, 'environment has popular genres').toBeVisible();
    await expect(homePage.artistSectionHeading, 'environment has trending artists').toBeVisible();

    await test.step('at most 8 genres and 10 trending artists', async () => {
      expect(await homePage.genreTiles.count()).toBeLessThanOrEqual(discoveryLimits.homeGenres);
      expect(await homePage.artistNameLinks.count()).toBeLessThanOrEqual(discoveryLimits.homeArtists);
      await expect(homePage.genreTiles.first()).toBeVisible();
      await expect(homePage.artistNameLinks.first()).toBeVisible();
    });

    await test.step('See all of the genres opens Genres & Topics', async () => {
      await homePage.genreSeeAll.click();
      await expect(page).toHaveURL(appUrl('/genres'));
      await expect(page.getByRole('main').getByRole('heading', { level: 2, name: /^Discover .+ Genre$/ }).first()).toBeVisible();
    });

    await test.step('See all of the artists opens Charts', async () => {
      await homePage.open();
      await homePage.artistSeeAll.click();
      await expect(page).toHaveURL(appUrl('/charts'));
      await expect(chartsPage.chartHeadings.first()).toBeVisible();
    });

    await test.step('a genre card opens that genre', async () => {
      await homePage.open();
      const href = await homePage.genreTiles.first().getAttribute('href');
      const genre = await homePage.openGenre(0);
      await expect(categoryPage.name).toHaveText(genre);
      await expect(page).toHaveURL(appUrl(href!));
    });

    await test.step('an artist card opens that artist', async () => {
      await homePage.open();
      const artist = await homePage.openArtist(0);
      await expect(artistPage.name).toHaveText(artist.name);
      await expect(page).toHaveURL(appUrl(`/artist/${artist.id}`));
    });
  });
});

test.describe('US-008 Top charts', () => {
  test.beforeEach(async ({ chartsPage }) => {
    await chartsPage.open();
    // Wait on the charts themselves: the previous page's content can stay for a moment (UF-02).
    await expect(chartsPage.chartHeadings.first(), 'environment has popular genres').toBeVisible();
  });

  test('TS-DISC-08 charts structure', { tag: ['@regression'] }, async ({ page, chartsPage }) => {
    const charts = await chartsPage.chartHeadings.count();

    await test.step('at most 10 charts, each ranked from 1, at most 10 rows', async () => {
      expect(charts).toBeLessThanOrEqual(discoveryLimits.charts);
      for (let index = 0; index < charts; index++) {
        const ranks = await chartsPage.ranks(index);
        expect(ranks.length, `rows of chart ${index + 1}`).toBeGreaterThan(0);
        expect(ranks.length).toBeLessThanOrEqual(discoveryLimits.chartRows);
        expect(ranks.map(Number), `ranks of chart ${index + 1}`).toEqual(ranks.map((_, rank) => rank + 1));
      }
    });

    await test.step('Vietnamese and Western music come first', async () => {
      const ids = await chartsPage.genreIds();
      expect(ids).toHaveLength(charts);
      const leading = ids.filter((id) => chartsFirst.includes(id));
      expect(ids.slice(0, leading.length), 'genres 10 and 26, when present, lead in id order').toEqual(
        [...leading].sort((a, b) => a - b),
      );
    });

    await test.step('no artists block and no favorite control', async () => {
      await expect(page.getByRole('main').getByRole('heading', { name: uiText.trendingArtists })).toHaveCount(0);
      await expect(chartsPage.favoriteIcons).toHaveCount(0);
    });
  });

  test('TS-DISC-09 chart links', { tag: ['@regression'] }, async ({ page, chartsPage, songPage, artistPage }) => {
    await test.step('a song title opens that song', async () => {
      const title = await chartsPage.openFirstSong(0);
      await expect(page).toHaveURL(/\/song\/\d+$/);
      await expect(songPage.title).toHaveText(title);
    });

    await test.step('an artist name opens that artist', async () => {
      await page.goBack();
      await expect(chartsPage.chartHeadings.first()).toBeVisible();
      const name = await chartsPage.openFirstArtist(0);
      await expect(page).toHaveURL(/\/artist\/\d+$/);
      await expect(artistPage.name).toHaveText(name);
    });
  });
});
