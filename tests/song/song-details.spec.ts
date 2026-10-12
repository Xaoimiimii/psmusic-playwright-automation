import { songRoutes, type RelatedSong, type SongArtist, type SongDetail } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { uiText } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';
import { knownDefect } from '../../src/support/known-defect';
import { timeTaggedLineCount } from '../../src/support/lyrics';
import { nextApiResponse, requestBarrier } from '../../src/support/network';
import { signInThroughApi } from '../../src/support/session';

/** Max other songs by the artists (`SongRepository.GetRelatedSongs`, `Take(30)`). */
const MAX_OTHER_SONGS = 30;

test.describe('US-011 Song details', () => {
  test('TS-SONG-01 song page content', { tag: ['@critical'] }, async ({ page, songPage, apiTraffic }) => {
    const songId = catalog.songWithMedia;
    const detailResponse = nextApiResponse(page, 'GET', songRoutes.detail(songId));
    const artistsResponse = nextApiResponse(page, 'GET', songRoutes.artistsOfSong(songId));
    await songPage.open(songId);
    const detail = (await (await detailResponse).json()) as SongDetail;
    const artists = (await (await artistsResponse).json()) as SongArtist[];

    await test.step('UI matches the detail and artists responses of the same load', async () => {
      // Counters are shared with other users, so they are compared with this load's response, not a fixed number.
      await expect(songPage.title).toHaveText(detail.title);
      await expect(songPage.cover).toHaveAttribute('src', detail.imageUrl);
      await expect(songPage.favoriteCounter).toHaveText(String(detail.favorite));
      await expect(songPage.reviewCounter).toHaveText(String(detail.reviews));
      await expect(songPage.artistNames).toHaveText(artists.map((artist) => artist.name));
      expect(artists.map((artist) => artist.name).join(', '), 'artists response agrees with detail.artist').toBe(detail.artist);
    });

    await test.step('UI: Play, Download, lyrics and the Artists list are shown', async () => {
      await expect(songPage.playButton).toHaveText(uiText.play);
      await expect(songPage.downloadButton).toBeVisible();
      await expect(songPage.lyricLines.first()).toBeVisible();
      await expect(songPage.artistsHeading).toBeVisible();
      await expect(songPage.artistRows).toHaveText(artists.map((artist) => artist.name));
    });

    await test.step('UI: the page heart and star only show counts', async () => {
      const mark = apiTraffic.mark();
      await songPage.heartIcon.click();
      await songPage.starIcon.click();
      await requestBarrier(page);

      expect(apiTraffic.after(mark, 'POST', songRoutes.favoriteToggle(songId)), 'favorite requests').toHaveLength(0);
      expect(apiTraffic.after(mark, 'POST', songRoutes.addReview(songId)), 'review requests').toHaveLength(0);
      await expect(songPage.favoriteCounter).toHaveText(String(detail.favorite));
    });
  });

  test.describe('TS-SONG-03 lyrics display', () => {
    test('time-tagged lines are shown and collapse and expand', { tag: ['@regression'] }, async ({
      page,
      request,
      songPage,
    }) => {
      const songId = catalog.songWithMedia;
      const detailResponse = nextApiResponse(page, 'GET', songRoutes.detail(songId));
      await songPage.open(songId);
      const detail = (await (await detailResponse).json()) as SongDetail;

      await expect(songPage.lyricLines).toHaveCount(await timeTaggedLineCount(request, detail.lyricUrl));
      await expect(songPage.noLyricsMessage).toHaveCount(0);
      await expect(songPage.lyricsScroller).toHaveClass(/lyrics-collapsed/);
      await expect(songPage.lyricsToggle).toHaveText(uiText.showMore);

      await songPage.toggleLyrics();
      await expect(songPage.lyricsScroller).toHaveClass(/lyrics-expanded/);
      await expect(songPage.lyricsToggle).toHaveText(uiText.showLess);

      await songPage.toggleLyrics();
      await expect(songPage.lyricsScroller).toHaveClass(/lyrics-collapsed/);
      await expect(songPage.lyricsToggle).toHaveText(uiText.showMore);
    });

    test('a song without lyrics shows the no-lyrics message', { tag: ['@regression'] }, async ({ songPage, songApi }) => {
      expect((await songApi.detailOrThrow(catalog.songWithoutLyrics)).lyricUrl, 'precondition: no lyric file').toBe('');

      await songPage.open(catalog.songWithoutLyrics);

      await expect(songPage.noLyricsMessage).toBeVisible();
      await expect(songPage.lyricLines).toHaveCount(0);
      await expect(songPage.lyricsToggle).toHaveCount(0);
    });
  });

  test.describe('TS-SONG-05 other songs by the artist', () => {
    test('more than 4: all rows listed, View More and Show Less', { tag: ['@regression'] }, async ({ page, songPage }) => {
      const songId = catalog.songWithMedia;
      const relatedResponse = nextApiResponse(page, 'GET', songRoutes.related(songId));
      const artistsResponse = nextApiResponse(page, 'GET', songRoutes.artistsOfSong(songId));
      await songPage.open(songId);
      const related = (await (await relatedResponse).json()) as RelatedSong[];
      const artists = (await (await artistsResponse).json()) as SongArtist[];
      expect(related.length, 'precondition: more than 4 other songs').toBeGreaterThan(4);

      await test.step('every other song is listed, at most 30', async () => {
        expect(related.length).toBeLessThanOrEqual(MAX_OTHER_SONGS);
        await expect(songPage.otherSongsHeading).toHaveText(
          `${uiText.otherSongsBy} ${artists.map((artist) => artist.name).join(', ')}`,
        );
        await expect(songPage.otherSongTitles).toHaveCount(related.length);
        // The related list has no defined order, so the titles are compared as sets.
        const shown = (await songPage.otherSongTitles.allTextContents()).map((title) => title.trim()).sort();
        expect(shown).toEqual(related.map((song) => song.title).sort());
      });

      await test.step('View More expands the list and Show Less collapses it', async () => {
        await expect(songPage.otherSongsList).toHaveClass(/songs-collapsed/);
        await expect(songPage.otherSongsToggle).toHaveText(uiText.viewMore);
        const collapsedHeight = await songPage.otherSongsListHeight();

        await songPage.toggleOtherSongs();
        await expect(songPage.otherSongsList).toHaveClass(/songs-expanded/);
        await expect(songPage.otherSongsToggle).toHaveText(uiText.showLess);
        await expect.poll(() => songPage.otherSongsListHeight(), { message: 'list grows' }).toBeGreaterThan(collapsedHeight);

        await songPage.toggleOtherSongs();
        await expect(songPage.otherSongsList).toHaveClass(/songs-collapsed/);
        await expect(songPage.otherSongsToggle).toHaveText(uiText.viewMore);
        await expect.poll(() => songPage.otherSongsListHeight(), { message: 'list shrinks back' }).toBe(collapsedHeight);
      });
    });

    test('exactly 4: all rows listed, no View More', { tag: ['@regression'] }, async ({ songPage, songApi }) => {
      const related = await songApi.relatedOrThrow(catalog.songWithFourOtherSongs);
      expect(related, 'precondition: exactly 4 other songs').toHaveLength(4);

      await songPage.open(catalog.songWithFourOtherSongs);

      await expect(songPage.otherSongTitles).toHaveCount(4);
      await expect(songPage.otherSongsToggle).toHaveCount(0);
    });

    test('none: the section is not shown', { tag: ['@regression'] }, async ({ songPage, songApi }) => {
      expect(await songApi.relatedOrThrow(catalog.songWithoutOtherSongs), 'precondition: no other song').toHaveLength(0);

      await songPage.open(catalog.songWithoutOtherSongs);

      await expect(songPage.title).toBeVisible();
      await expect(songPage.artistsHeading).toBeVisible();
      await expect(songPage.otherSongsSection).toHaveCount(0);
    });
  });

  test('TS-SONG-06 heart state after in-app navigation and reload', {
    tag: ['@critical'],
    annotation: {
      type: 'pending-data',
      description: 'Favorite half only. The star (review) half needs a permanent review and waits for the write environment (D-WR, TR-01).',
    },
  }, async ({ page, context, authApi, songApi, registeredUser, favoritesPage, songPage }) => {
    const songId = catalog.songWithMedia;
    // The favorite is set through the API before the browser signs in: the browser's login is the latest session.
    const { token } = await authApi.loginOrThrow(registeredUser);
    const accessToken = token!;
    expect(await songApi.toggleFavoriteOrThrow(songId, accessToken), 'precondition: favorited').toBe(true);

    try {
      await signInThroughApi(context, registeredUser);
      const player = await songApi.playerOrThrow(songId, accessToken);
      expect(player.isFavorited, 'API: /player says favorited').toBe(true);

      await test.step('UI: in-app navigation shows a filled heart', async () => {
        await favoritesPage.open();
        await expect(favoritesPage.playlistHeading).toBeVisible();
        await favoritesPage.openSong(player.title);
        await expect(page).toHaveURL(new RegExp(`/song/${songId}$`));
        await expect(songPage.title).toHaveText(player.title);
        await expect(songPage.heartIcon).toHaveAttribute('fill', 'white');
      });

      await test.step('UI: a hard reload still shows a filled heart', async () => {
        await page.reload();
        await expect(songPage.title).toHaveText(player.title);
        knownDefect('BUG-US-011-AC-06', 'F-5: on hard reload the detail call is sent before auth/refresh, without a token, so the heart is empty');
        await expect(songPage.heartIcon).toHaveAttribute('fill', 'white');
      });
    } finally {
      // Restores the shared favorite counter of song 1.
      if ((await songApi.playerOrThrow(songId, accessToken)).isFavorited) {
        await songApi.toggleFavoriteOrThrow(songId, accessToken);
      }
    }
  });

  test('TS-SONG-07 lyric file cannot be fetched', {
    tag: ['@sit-controlled'],
    annotation: [
      { type: 'controlled-response', description: 'The S3 request for the LRC file is aborted in the browser.' },
      {
        type: 'pending-decision',
        description: 'US-011-AC-08 leaves open whether a message is shown. The current behavior (the no-lyrics message) is asserted.',
      },
    ],
  }, async ({ page, songApi, songPage }) => {
    const songId = catalog.songWithMedia;
    const { lyricUrl, title } = await songApi.detailOrThrow(songId);
    await page.route(lyricUrl, (route) => route.abort());
    const lyricFailed = page.waitForEvent('requestfailed', (request) => request.url() === lyricUrl);

    await songPage.open(songId);
    await lyricFailed;

    await test.step('UI: no lyrics, the message instead', async () => {
      await expect(songPage.noLyricsMessage).toBeVisible();
      await expect(songPage.lyricLines).toHaveCount(0);
      await expect(songPage.lyricsToggle).toHaveCount(0);
    });

    await test.step('UI: the rest of the page and playback still work', async () => {
      await expect(songPage.title).toHaveText(title);
      await expect(songPage.artistRows.first()).toBeVisible();
      await songPage.play();
      await expect(songPage.playButton).toHaveText(uiText.pause);
    });
  });
});
