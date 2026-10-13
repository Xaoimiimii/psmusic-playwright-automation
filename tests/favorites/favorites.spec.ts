import { songRoutes } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { serverMessage } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';
import { removeFavorites } from '../../src/support/favorites';
import { knownDefect } from '../../src/support/known-defect';
import { nextApiResponse } from '../../src/support/network';
import { playFromSongPage } from '../../src/support/playback';

// Favorites change the shared like counters, so each test uses its own song (catalog.songFor…) and asserts deltas.
// Every favorite a test sets is removed in `finally`.
test.describe('US-015 Favorite and unfavorite', () => {
  test.describe('TS-FAV-01 favorite and unfavorite update state and counts', () => {
    test('heart, API response and like count move together', { tag: ['@critical'] }, async ({
      page,
      header,
      songPage,
      playerBar,
      authApi,
      songApi,
      listeningMember,
    }) => {
      const songId = catalog.songForFavoriteToggle;
      const { token } = await authApi.loginOrThrow(listeningMember);
      const likes = async () => (await songApi.playerOrThrow(songId)).likes;
      try {
        await songPage.open(songId);
        await expect(header.userMenuButton, 'precondition: signed in').toBeVisible();
        const { player } = await playFromSongPage(page, songPage, songId);
        expect(player.isFavorited, 'precondition: not a favorite').toBe(false);
        await expect(playerBar.favoriteIcon).toHaveAttribute('fill', 'transparent');
        const likesBefore = await likes();

        await test.step('favorite: heart filled, "added" response, like count +1', async () => {
          const toggled = nextApiResponse(page, 'POST', songRoutes.favoriteToggle(songId));
          await playerBar.toggleFavorite();
          expect(await (await toggled).json()).toEqual({ message: serverMessage.favoriteAdded, isFavorited: true });
          await expect(playerBar.favoriteIcon).toHaveAttribute('fill', 'white');
          expect((await songApi.playerOrThrow(songId, token!)).isFavorited).toBe(true);
          expect(await likes()).toBe(likesBefore + 1);
        });

        await test.step('unfavorite: heart cleared, "removed" response, like count back', async () => {
          const toggled = nextApiResponse(page, 'POST', songRoutes.favoriteToggle(songId));
          await playerBar.toggleFavorite();
          expect(await (await toggled).json()).toEqual({ message: serverMessage.favoriteRemoved, isFavorited: false });
          await expect(playerBar.favoriteIcon).toHaveAttribute('fill', 'transparent');
          expect((await songApi.playerOrThrow(songId, token!)).isFavorited).toBe(false);
          const likesAfter = await likes();
          expect(likesAfter).toBe(likesBefore);
          expect(likesAfter).toBeGreaterThanOrEqual(0);
        });
      } finally {
        await removeFavorites(authApi, songApi, listeningMember, [songId]);
      }
    });

    test('the song page like count follows the toggle', { tag: ['@critical'] }, async ({
      page,
      header,
      songPage,
      playerBar,
      authApi,
      songApi,
      listeningMember,
    }) => {
      // Another song than the test above: this one only reads the page counter, but both toggle.
      const songId = catalog.songForFavoritesPage;
      try {
        await songPage.open(songId);
        await expect(header.userMenuButton, 'precondition: signed in').toBeVisible();
        await playFromSongPage(page, songPage, songId);
        const countBefore = Number(await songPage.favoriteCounter.innerText());

        const toggled = nextApiResponse(page, 'POST', songRoutes.favoriteToggle(songId));
        await playerBar.toggleFavorite();
        expect((await (await toggled).json()).isFavorited).toBe(true);
        await expect(playerBar.favoriteIcon).toHaveAttribute('fill', 'white');

        knownDefect('BUG-US-015-AC-01', 'F-6: the song-page like count keeps its page-load value until a reload');
        await expect(songPage.favoriteCounter).toHaveText(String(countBefore + 1));
      } finally {
        await removeFavorites(authApi, songApi, listeningMember, [songId]);
      }
    });
  });

  test('TS-FAV-03 the Favorites page reflects a change at once', { tag: ['@regression'] }, async ({
    page,
    header,
    sidebar,
    songPage,
    playerBar,
    favoritesPage,
    authApi,
    songApi,
    listeningMember,
  }) => {
    const songId = catalog.songForFavoritesPage;
    try {
      await songPage.open(songId);
      await expect(header.userMenuButton, 'precondition: signed in').toBeVisible();
      const { player } = await playFromSongPage(page, songPage, songId);

      // Only in-app navigation from here on: the favorites cache lives in page memory (15 minutes).
      await test.step('a first visit caches the empty playlist', async () => {
        await sidebar.openFavorites();
        await expect(favoritesPage.emptyStateMessage).toBeVisible();
      });

      await test.step('after favoriting, the playlist shows the song', async () => {
        const toggled = nextApiResponse(page, 'POST', songRoutes.favoriteToggle(songId));
        await playerBar.toggleFavorite();
        expect((await (await toggled).json()).isFavorited).toBe(true);
        await sidebar.openDiscover();
        await sidebar.openFavorites();
        await expect(favoritesPage.playlistHeading).toBeVisible();
        await expect(favoritesPage.songTitle(player.title)).toBeVisible();
      });

      await test.step('after unfavoriting, the playlist is empty again', async () => {
        const toggled = nextApiResponse(page, 'POST', songRoutes.favoriteToggle(songId));
        await playerBar.toggleFavorite();
        expect((await (await toggled).json()).isFavorited).toBe(false);
        await sidebar.openDiscover();
        await sidebar.openFavorites();
        await expect(favoritesPage.emptyStateMessage).toBeVisible();
      });
    } finally {
      await removeFavorites(authApi, songApi, listeningMember, [songId]);
    }
  });

  test('TS-FAV-04 re-favoriting reuses the same record', { tag: ['@regression', '@api'] }, async ({
    authApi,
    songApi,
    registeredUser,
  }) => {
    const songId = catalog.songForFavoriteRecord;
    const { token } = await authApi.loginOrThrow(registeredUser);
    const likes = async () => (await songApi.playerOrThrow(songId)).likes;
    try {
      const likesBefore = await likes();
      // One record per user and song: each toggle flips it, so the count moves by exactly one and comes back.
      for (const [step, favorited] of [true, false, true, false].entries()) {
        await test.step(`toggle ${step + 1}: ${favorited ? 'favorite' : 'unfavorite'}`, async () => {
          expect(await songApi.toggleFavoriteOrThrow(songId, token!)).toBe(favorited);
          expect(await likes()).toBe(likesBefore + (favorited ? 1 : 0));
        });
      }
    } finally {
      await removeFavorites(authApi, songApi, registeredUser, [songId]);
    }
  });
});
