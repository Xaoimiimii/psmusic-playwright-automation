import type { SongPlayer } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { uiText } from '../../src/data/messages';
import { playerBarTitle } from '../../src/data/player';
import { test, expect } from '../../src/fixtures/test';
import { AUDIO_START_TIMEOUT_MS, type PlayerBar } from '../../src/pages/components/player-bar';
import { nextPlayerSongId } from '../../src/support/network';
import { playFromSongPage } from '../../src/support/playback';

/** The player bar shows the started song and its position moves forward. */
async function expectPlaying(playerBar: PlayerBar, song: SongPlayer): Promise<void> {
  await expect(playerBar.title).toHaveText(playerBarTitle(song.title));
  await expect(playerBar.artist).toHaveText(song.artist);
  await expect(playerBar.cover).toHaveAttribute('src', song.singerUrl || song.coverUrl);
  await expect
    .poll(() => playerBar.isPlaying(), { message: 'audio started', timeout: AUDIO_START_TIMEOUT_MS })
    .toBe(true);
  const position = await playerBar.audioPosition();
  await expect.poll(() => playerBar.audioPosition(), { message: 'position advances' }).toBeGreaterThan(position);
  await expect(playerBar.pauseIcon).toBeVisible();
}

test.describe('US-013 Play songs with player controls', () => {
  test.describe('TS-PLAY-01 start playback', () => {
    // Guests can play (US-013-AC-09) and record no stream (US-021-AC-02): nothing is written.
    test('as a guest', { tag: ['@critical'] }, async ({ page, songPage, playerBar }) => {
      await expect(playerBar.root).toHaveCount(0);

      const { player } = await playFromSongPage(page, songPage, catalog.songWithMedia);

      await expect(playerBar.root).toBeVisible();
      await expectPlaying(playerBar, player);
    });

    test('as a member', { tag: ['@critical'] }, async ({ page, header, songPage, playerBar, listeningMember }) => {
      await songPage.open(catalog.songWithMedia);
      await expect(header.userMenuButton, 'precondition: signed in').toBeVisible();

      const { player } = await playFromSongPage(page, songPage, catalog.songWithMedia);

      await expect(playerBar.root).toBeVisible();
      await expectPlaying(playerBar, player);
    });
  });

  test('TS-PLAY-02 pause and resume', { tag: ['@critical'] }, async ({ page, songPage, playerBar }) => {
    const { player } = await playFromSongPage(page, songPage, catalog.songWithMedia);
    await expectPlaying(playerBar, player);

    const pausedAt = await test.step('Pause stops the position and shows Play', async () => {
      await playerBar.togglePlayPause();
      await expect.poll(() => playerBar.isPaused(), { message: 'audio paused' }).toBe(true);
      await expect(playerBar.playIcon).toBeVisible();
      return playerBar.audioPosition();
    });

    await test.step('Play resumes from the paused position and shows Pause', async () => {
      expect(await playerBar.audioPosition(), 'position held while paused').toBe(pausedAt);
      await playerBar.togglePlayPause();
      await expect(playerBar.pauseIcon).toBeVisible();
      await expect.poll(() => playerBar.isPaused(), { message: 'audio resumed' }).toBe(false);
      await expect.poll(() => playerBar.audioPosition(), { message: 'position advances again' }).toBeGreaterThan(pausedAt);
      await expect(playerBar.title).toHaveText(playerBarTitle(player.title));
    });
  });

  test('TS-PLAY-07 next song starts when a song ends', { tag: ['@critical'] }, async ({ page, songPage, playerBar }) => {
    const { player, queue } = await playFromSongPage(page, songPage, catalog.songWithMedia);
    await expectPlaying(playerBar, player);
    await expect(playerBar.repeatButton, 'precondition: repeat off').toHaveAttribute('data-tooltip', uiText.repeatOff);
    const firstSource = await playerBar.audioSource();

    const nextSong = nextPlayerSongId(page);
    await playerBar.moveNearEnd();

    expect(await nextSong, 'the next queue song is loaded').toBe(queue[0].id);
    await expect(playerBar.title).toHaveText(playerBarTitle(queue[0].title));
    await expect.poll(() => playerBar.audioSource(), { message: 'audio switched to the next song' }).not.toBe(firstSource);
    await expect
      .poll(() => playerBar.isPlaying(), { message: 'next song playing', timeout: AUDIO_START_TIMEOUT_MS })
      .toBe(true);
  });
});
