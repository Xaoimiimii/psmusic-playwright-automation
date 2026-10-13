import { appUrl } from '../../src/config/env';
import { catalog } from '../../src/data/catalog';
import { playerBarTitle } from '../../src/data/player';
import { test, expect } from '../../src/fixtures/test';
import { AUDIO_START_TIMEOUT_MS } from '../../src/pages/components/player-bar';
import { holdStreamRecording } from '../../src/support/controlled-responses';
import { removeFavorites } from '../../src/support/favorites';
import { nextPlayerSongId } from '../../src/support/network';
import { playFromSongPage } from '../../src/support/playback';
import { hasRefreshCookie } from '../../src/support/session';

// Journeys prove that the pieces fit; edge cases stay in the feature tests (test-scenarios.md §14).
test.describe('Journeys', () => {
  test('TS-E2E-01 guest discovers and plays a song', { tag: ['@smoke', '@critical'] }, async ({
    page,
    header,
    homePage,
    categoryPage,
    songPage,
    playerBar,
  }) => {
    await test.step('Home lists genres to a first-time visitor', async () => {
      await homePage.open();
      await expect(header.loginButton, 'guest').toBeVisible();
      await expect(homePage.genreSectionHeading).toBeVisible();
      await expect(homePage.genreTiles.first()).toBeVisible();
    });

    const genre = await homePage.openGenre(0);

    await test.step(`the genre page "${genre}" lists songs`, async () => {
      // Wait on the genre name, not the URL: the previous page's content can stay for a moment (R-SYNC).
      await expect(categoryPage.name).toHaveText(genre);
      await expect(page).toHaveURL(/\/category\/\d+$/);
      await expect(categoryPage.songLinks.first()).toBeVisible();
    });

    const song = await categoryPage.openSong(0);

    await test.step(`the song page of "${song.title}" opens`, async () => {
      await expect(page).toHaveURL(appUrl(`/song/${song.id}`));
      await expect(songPage.title).toHaveText(song.title);
    });

    await test.step('Play starts the song in the player bar', async () => {
      await songPage.play();
      await expect(playerBar.title).toHaveText(playerBarTitle(song.title));
      await expect
        .poll(() => playerBar.isPlaying(), { message: 'audio playing', timeout: AUDIO_START_TIMEOUT_MS })
        .toBe(true);
    });
  });

  test('TS-E2E-02 member listens, favorites and logs out', { tag: ['@critical'] }, async ({
    page,
    context,
    authPage,
    header,
    sidebar,
    songPage,
    playerBar,
    favoritesPage,
    authApi,
    songApi,
    registeredUser,
  }) => {
    const songId = catalog.songWithMedia;
    await holdStreamRecording(page);
    try {
      await test.step('log in', async () => {
        await authPage.open();
        await authPage.login(registeredUser);
        await expect(header.userMenuButton).toBeVisible();
      });

      const { player, queue } = await playFromSongPage(page, songPage, songId);
      await expect
        .poll(() => playerBar.isPlaying(), { message: 'song playing', timeout: AUDIO_START_TIMEOUT_MS })
        .toBe(true);

      await test.step('favorite the song from the player bar', async () => {
        await playerBar.toggleFavorite();
        await expect(playerBar.favoriteIcon).toHaveAttribute('fill', 'white');
      });

      await test.step('move on to the next song', async () => {
        // Play All only pauses when the playing song is already in the playlist, so another song plays first.
        const loaded = nextPlayerSongId(page);
        await playerBar.next();
        expect(await loaded).toBe(queue[0].id);
      });

      await test.step('the song is in the Favorite Playlist', async () => {
        await sidebar.openFavorites();
        await expect(favoritesPage.playlistHeading).toBeVisible();
        await expect(favoritesPage.songTitle(player.title)).toBeVisible();
      });

      await test.step('Play All plays it from the playlist', async () => {
        const loaded = nextPlayerSongId(page);
        await favoritesPage.playAll();
        expect(await loaded).toBe(songId);
        await expect(playerBar.title).toHaveText(playerBarTitle(player.title));
        await expect
          .poll(() => playerBar.isPlaying(), { message: 'playlist song playing', timeout: AUDIO_START_TIMEOUT_MS })
          .toBe(true);
      });

      await test.step('log out', async () => {
        // Only "signed out" is asserted: the landing page is TS-AUTH-10's (known defect US-004-AC-01).
        await header.logout();
        await expect.poll(() => hasRefreshCookie(context), { message: 'session cookie removed' }).toBe(false);
        await expect(header.userMenuButton).toBeHidden();
      });
    } finally {
      await removeFavorites(authApi, songApi, registeredUser, [songId]);
    }
  });
});
