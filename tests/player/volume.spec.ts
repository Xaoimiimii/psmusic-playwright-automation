import { catalog } from '../../src/data/catalog';
import { uiText } from '../../src/data/messages';
import { playerVolume } from '../../src/data/player';
import { test, expect } from '../../src/fixtures/test';

test.describe('US-013 Play songs with player controls', () => {
  // Guest on purpose: guests can play (US-013-AC-09) and a guest records no stream (US-021-AC-02), so nothing is
  // written to the shared database. The volume is read from the audio element, so the test does not wait for S3 audio.
  test('TS-PLAY-06 volume defaults to 70% and mute restores the previous volume', { tag: ['@regression'] }, async ({
    songPage,
    playerBar,
  }) => {
    await songPage.open(catalog.songWithMedia);
    await songPage.play();
    await expect(playerBar.root).toBeVisible();

    await test.step('a fresh session starts at 70%', async () => {
      await expect(playerBar.volumeSlider).toHaveValue(String(playerVolume.default));
      expect(await playerBar.audioVolume()).toBe(playerVolume.default);
      await expect(playerBar.muteButton).toHaveAttribute('data-tooltip', uiText.mute);
    });

    await test.step('changing the slider changes the audio volume', async () => {
      await playerBar.setVolume(playerVolume.changed);
      await expect.poll(() => playerBar.audioVolume()).toBe(playerVolume.changed);
    });

    await test.step('mute sets the volume to 0', async () => {
      await playerBar.toggleMute();
      await expect.poll(() => playerBar.audioVolume()).toBe(playerVolume.muted);
      await expect(playerBar.volumeSlider).toHaveValue(String(playerVolume.muted));
      await expect(playerBar.muteButton).toHaveAttribute('data-tooltip', uiText.unmute);
    });

    await test.step('unmute restores the volume set before muting', async () => {
      await playerBar.toggleMute();
      await expect.poll(() => playerBar.audioVolume()).toBe(playerVolume.changed);
      await expect(playerBar.volumeSlider).toHaveValue(String(playerVolume.changed));
      await expect(playerBar.muteButton).toHaveAttribute('data-tooltip', uiText.mute);
    });
  });
});
