import { songRoutes, type NextBatchSong } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { uiText } from '../../src/data/messages';
import { playerBarTitle, queueRefill } from '../../src/data/player';
import { test, expect } from '../../src/fixtures/test';
import { AUDIO_START_TIMEOUT_MS } from '../../src/pages/components/player-bar';
import { endQueueAfter } from '../../src/support/controlled-responses';
import { nextApiResponse, nextPlayerSongId, requestBarrier } from '../../src/support/network';
import { playFromSongPage } from '../../src/support/playback';

// Guest on purpose in every test: the queue behaves the same for members, and a guest records no stream.
// The queue is random (TR-08), so expectations come from the next-batch response of the same run.
test.describe('US-013 Play songs with player controls', () => {
  test('TS-PLAY-03 next, previous and queue refill', { tag: ['@critical'] }, async ({
    page,
    songPage,
    playerBar,
    apiTraffic,
  }) => {
    const start = catalog.songWithMedia;
    const { queue } = await playFromSongPage(page, songPage, start);
    await expect(playerBar.root).toBeVisible();

    await test.step('the queue holds only songs with lyrics', async () => {
      expect(queue.length, 'first batch size').toBe(queueRefill.batchSize);
      expect(queue.filter((song) => !song.lyricUrl), 'songs without lyrics').toEqual([]);
    });

    await test.step('Next plays the following song, Previous the one before', async () => {
      let loaded = nextPlayerSongId(page);
      await playerBar.next();
      expect(await loaded, 'Next').toBe(queue[0].id);
      await expect(playerBar.title).toHaveText(playerBarTitle(queue[0].title));

      loaded = nextPlayerSongId(page);
      await playerBar.previous();
      expect(await loaded, 'Previous').toBe(start);
    });

    const refill = await test.step('a new batch is requested once 3 or fewer songs are left', async () => {
      // Back on the start song the queue is [start, ...queue]; Next to queue[i] leaves queue.length - i songs
      // counting the one it starts.
      const lastWithoutRefill = queue.length - queueRefill.remainingSongs - 1;
      const mark = apiTraffic.mark();
      for (let index = 0; index <= lastWithoutRefill; index++) {
        const loaded = nextPlayerSongId(page);
        await playerBar.next();
        expect(await loaded, `Next to queue song ${index + 1}`).toBe(queue[index].id);
      }
      await requestBarrier(page);
      expect(
        apiTraffic.after(mark, 'GET', songRoutes.nextBatch),
        `no refill while ${queueRefill.remainingSongs + 1} songs are left`,
      ).toEqual([]);

      const refillResponse = nextApiResponse(page, 'GET', songRoutes.nextBatch);
      const loaded = nextPlayerSongId(page);
      await playerBar.next();
      expect(await loaded).toBe(queue[lastWithoutRefill + 1].id);
      const batch = (await (await refillResponse).json()) as NextBatchSong[];
      expect(batch.length, 'refill batch size').toBe(queueRefill.batchSize);
      expect(batch.filter((song) => !song.lyricUrl), 'refill songs without lyrics').toEqual([]);
      return { batch, nextIndex: lastWithoutRefill + 2 };
    });

    await test.step('after the first batch, Next continues with the refill batch', async () => {
      for (let index = refill.nextIndex; index < queue.length; index++) {
        const loaded = nextPlayerSongId(page);
        await playerBar.next();
        expect(await loaded).toBe(queue[index].id);
      }
      const loaded = nextPlayerSongId(page);
      await playerBar.next();
      expect(await loaded, 'first song of the refill batch').toBe(refill.batch[0].id);
    });
  });

  test.describe('TS-PLAY-04 repeat modes', () => {
    test('Repeat cycles Off, All, One, Off', { tag: ['@critical'] }, async ({ page, songPage, playerBar }) => {
      await playFromSongPage(page, songPage, catalog.songWithMedia);
      await expect(playerBar.repeatButton).toHaveAttribute('data-tooltip', uiText.repeatOff);
      await expect(playerBar.repeatButton).not.toHaveClass(/_active_/);

      for (const state of [uiText.repeatAll, uiText.repeatOne, uiText.repeatOff]) {
        await playerBar.cycleRepeat();
        await expect(playerBar.repeatButton).toHaveAttribute('data-tooltip', state);
        if (state === uiText.repeatOff) await expect(playerBar.repeatButton).not.toHaveClass(/_active_/);
        else await expect(playerBar.repeatButton).toHaveClass(/_active_/);
      }
    });

    test('Repeat One restarts the same song', { tag: ['@critical'] }, async ({ page, songPage, playerBar, apiTraffic }) => {
      const { player } = await playFromSongPage(page, songPage, catalog.songWithMedia);
      await expect.poll(() => playerBar.isPlaying(), { timeout: AUDIO_START_TIMEOUT_MS }).toBe(true);
      await playerBar.cycleRepeat();
      await playerBar.cycleRepeat();
      await expect(playerBar.repeatButton).toHaveAttribute('data-tooltip', uiText.repeatOne);
      const source = await playerBar.audioSource();
      const mark = apiTraffic.mark();

      await playerBar.moveNearEnd();

      await expect.poll(() => playerBar.audioPosition(), { message: 'song restarted from the beginning' }).toBeLessThan(5);
      await expect.poll(() => playerBar.isPlaying(), { message: 'still playing', timeout: AUDIO_START_TIMEOUT_MS }).toBe(true);
      expect(await playerBar.audioSource(), 'same MP3').toBe(source);
      await expect(playerBar.title).toHaveText(playerBarTitle(player.title));
      await requestBarrier(page);
      expect(apiTraffic.playerSongIds(mark), 'no other song loaded').toEqual([]);
    });

    test('Repeat All restarts the queue from the first song', { tag: ['@critical'] }, async ({
      page,
      songApi,
      songPage,
      playerBar,
    }) => {
      const start = catalog.songWithMedia;
      // A real queue is refilled before it can end, so the queue is made of one real catalog song, then nothing.
      const [onlyQueued] = await songApi.nextBatchOrThrow(1);
      await endQueueAfter(page, [onlyQueued]);
      await playFromSongPage(page, songPage, start);

      let loaded = nextPlayerSongId(page);
      await playerBar.next();
      expect(await loaded, 'last song of the queue').toBe(onlyQueued.id);
      await playerBar.cycleRepeat();
      await expect(playerBar.repeatButton).toHaveAttribute('data-tooltip', uiText.repeatAll);

      loaded = nextPlayerSongId(page);
      await playerBar.moveNearEnd();

      expect(await loaded, 'first song of the queue').toBe(start);
      await expect.poll(() => playerBar.isPlaying(), { message: 'first song playing', timeout: AUDIO_START_TIMEOUT_MS }).toBe(true);
    });
  });

  test('TS-PLAY-05 shuffle reorders the rest of the queue and can be undone', { tag: ['@critical'] }, async ({
    page,
    songPage,
    playerBar,
    apiTraffic,
  }) => {
    const start = catalog.songWithMedia;
    const { player, queue } = await playFromSongPage(page, songPage, start);
    const original = [start, ...queue.map((song) => song.id)];
    // 4 songs out of 10: the chance that a shuffle keeps them in the same order is 1 in 5040.
    const played = 4;

    await test.step('turning shuffle on keeps the current song playing', async () => {
      await expect(playerBar.shuffleButton).toHaveAttribute('data-tooltip', uiText.enableShuffle);
      const mark = apiTraffic.mark();
      await playerBar.toggleShuffle();
      await expect(playerBar.shuffleButton).toHaveAttribute('data-tooltip', uiText.disableShuffle);
      await requestBarrier(page);
      expect(apiTraffic.playerSongIds(mark), 'no song change').toEqual([]);
      await expect(playerBar.title).toHaveText(playerBarTitle(player.title));
    });

    const shuffled = await test.step('Next plays the other queue songs in a new order', async () => {
      const ids: number[] = [];
      for (let index = 0; index < played; index++) {
        const loaded = nextPlayerSongId(page);
        await playerBar.next();
        ids.push(await loaded);
      }
      expect(new Set(ids).size, 'no song twice').toBe(played);
      for (const id of ids) expect(queue.map((song) => song.id), 'songs come from the queue').toContain(id);
      expect(ids, 'order changed').not.toEqual(original.slice(1, played + 1));
      return ids;
    });

    await test.step('the current song stays first: Previous back to the start leads to it', async () => {
      for (let index = played - 2; index >= -1; index--) {
        const loaded = nextPlayerSongId(page);
        await playerBar.previous();
        expect(await loaded).toBe(index >= 0 ? shuffled[index] : start);
      }
      for (const id of shuffled) {
        const loaded = nextPlayerSongId(page);
        await playerBar.next();
        expect(await loaded).toBe(id);
      }
    });

    await test.step('turning shuffle off restores the original order', async () => {
      await playerBar.toggleShuffle();
      await expect(playerBar.shuffleButton).toHaveAttribute('data-tooltip', uiText.enableShuffle);
      const current = shuffled[played - 1];
      const loaded = nextPlayerSongId(page);
      await playerBar.previous();
      expect(await loaded, 'Previous plays the song before it in the original queue').toBe(original[original.indexOf(current) - 1]);
    });
  });
});
