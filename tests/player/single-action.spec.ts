import type { Page } from '@playwright/test';
import { songRoutes } from '../../src/api/song-api';
import { appUrl } from '../../src/config/env';
import { catalog } from '../../src/data/catalog';
import { test, expect } from '../../src/fixtures/test';
import type { PlayerBar } from '../../src/pages/components/player-bar';
import { removeFavorites } from '../../src/support/favorites';
import { nextPlayerSongId, requestBarrier, type ApiTrafficLog } from '../../src/support/network';
import { playFromSongPage } from '../../src/support/playback';

/** Control copies rendered while a song plays (`pages-and-locators.md` §0.6, F-3). */
const COPIES_ON_SONG_PAGE = 3;
const COPIES_ON_HOME = 2;

/** One click on Next loads exactly one song, the next in the queue. */
async function expectOneSongForward(page: Page, playerBar: PlayerBar, apiTraffic: ApiTrafficLog, expected: number) {
  const mark = apiTraffic.mark();
  const loaded = nextPlayerSongId(page);
  await playerBar.next();
  expect(await loaded).toBe(expected);
  await requestBarrier(page);
  expect(apiTraffic.playerSongIds(mark), 'songs loaded by one click').toEqual([expected]);
}

/** One click on the heart sends one toggle and turns the heart on once. */
async function expectOneFavoriteToggle(page: Page, playerBar: PlayerBar, apiTraffic: ApiTrafficLog, songId: number) {
  await expect(playerBar.favoriteIcon, 'precondition: not a favorite').toHaveAttribute('fill', 'transparent');
  const mark = apiTraffic.mark();
  await playerBar.toggleFavorite();
  await expect(playerBar.favoriteIcon).toHaveAttribute('fill', 'white');
  await requestBarrier(page);
  const toggles = apiTraffic.after(mark, 'POST', songRoutes.favoriteToggle(songId));
  expect(toggles, 'favorite-toggle requests sent by one click').toHaveLength(1);
  expect(toggles[0].status).toBe(200);
}

test.describe('US-013 Play songs with player controls', () => {
  test('TS-PLAY-08 one click performs one action', { tag: ['@critical'] }, async ({
    page,
    header,
    sidebar,
    songPage,
    playerBar,
    apiTraffic,
    authApi,
    songApi,
    listeningMember,
  }) => {
    const favorited: number[] = [];
    try {
      await songPage.open(catalog.songWithMedia);
      await expect(header.userMenuButton, 'precondition: signed in').toBeVisible();
      const { queue } = await playFromSongPage(page, songPage, catalog.songWithMedia);

      await test.step(`on /song/:id (${COPIES_ON_SONG_PAGE} control copies)`, async () => {
        await expect(playerBar.allControlCopies).toHaveCount(COPIES_ON_SONG_PAGE);
        await expectOneSongForward(page, playerBar, apiTraffic, queue[0].id);
        favorited.push(queue[0].id);
        await expectOneFavoriteToggle(page, playerBar, apiTraffic, queue[0].id);
      });

      await test.step(`on / (${COPIES_ON_HOME} control copies)`, async () => {
        await sidebar.openDiscover();
        await expect(page).toHaveURL(appUrl('/'));
        await expect(playerBar.allControlCopies).toHaveCount(COPIES_ON_HOME);
        await expectOneSongForward(page, playerBar, apiTraffic, queue[1].id);
        favorited.push(queue[1].id);
        await expectOneFavoriteToggle(page, playerBar, apiTraffic, queue[1].id);
      });
    } finally {
      await removeFavorites(authApi, songApi, listeningMember, favorited);
    }
  });
});
