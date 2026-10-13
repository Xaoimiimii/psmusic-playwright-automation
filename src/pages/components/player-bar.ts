import type { Locator, Page } from '@playwright/test';
import { uiText } from '../../data/messages';
import { step } from '../../reporting/step';

/**
 * Time allowed for the first audio frames to play after Play is clicked. The MP3
 * streams from S3; with several browsers loading media in parallel the first
 * frames took more than the default 5 s poll (R-AUD, observed 2026-10-08).
 */
export const AUDIO_START_TIMEOUT_MS = 20_000;

/**
 * Fixed player bar at the bottom (`PlayerControl.jsx` inside `ClientLayout`'s
 * `playerWrapper`), rendered once playback has started. The page body and the
 * song page hold more copies of the same controls, so everything is scoped to
 * the wrapper (`docs/exploration/browser/pages-and-locators.md` §10).
 */
export class PlayerBar {
  readonly root: Locator;
  /**
   * Every rendered copy of the player controls, in and out of the wrapper: 3 on `/song/:id`, 2 on `/`
   * (`pages-and-locators.md` §0.6). Only the precondition of TS-PLAY-08 reads it.
   */
  readonly allControlCopies: Locator;
  /** Shortened to 25 characters plus "..." (`formatSongTitle`); a click opens the song page. */
  readonly title: Locator;
  readonly artist: Locator;
  readonly cover: Locator;
  readonly playPauseButton: Locator;
  /** Two bars: shown while playing. */
  readonly pauseIcon: Locator;
  /** Triangle: shown while paused. */
  readonly playIcon: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  /** `data-tooltip` names the action: "Enable Shuffle" while off, "Disable Shuffle" while on. */
  readonly shuffleButton: Locator;
  /** `data-tooltip` names the current state: "Repeat Off", "Repeat All" or "Repeat One". */
  readonly repeatButton: Locator;
  /** A `div`, not a button; its `lucide-heart` icon is the only stable hook. */
  readonly favoriteButton: Locator;
  /** `fill="white"` when the current song is a favorite, `transparent` otherwise. */
  readonly favoriteIcon: Locator;
  readonly rateButton: Locator;
  /** Range input 0–1 (step 0.01). The song page renders more copies, hence the scope to `root`. */
  readonly volumeSlider: Locator;
  /** Icon-only button; its `data-tooltip` reads Mute or Unmute (`uiText.mute` / `uiText.unmute`). */
  readonly muteButton: Locator;
  /** The single `<audio>` element of `PlayerContext`; it stays mounted on `/auth`. */
  private readonly audio: Locator;

  constructor(page: Page) {
    this.root = page.locator('[class*="playerWrapper"] [class*="player-controls-new"]');
    this.allControlCopies = page.locator('[class*="player-controls-new"]');
    const info = this.root.locator('[class*="player-info-left"]');
    this.title = info.locator('span[class*="song-title"]');
    this.artist = info.locator('span[class*="song-artist"]');
    this.cover = info.locator('img[class*="singer-avatar"]');
    this.playPauseButton = this.root.locator('button[class*="play-pause-btn"]');
    this.pauseIcon = this.playPauseButton.locator('svg rect').first();
    this.playIcon = this.playPauseButton.locator('svg polygon');
    this.nextButton = this.root.locator(`button[data-tooltip="${uiText.nextSong}"]`);
    this.previousButton = this.root.locator(`button[data-tooltip="${uiText.previousSong}"]`);
    this.shuffleButton = this.root.locator('button[class*="shuffle-btn"]');
    this.repeatButton = this.root.locator('button[class*="repeat-btn"]');
    this.favoriteButton = this.root
      .locator('[class*="player-main-row"] [class*="icon-button"]')
      .filter({ has: page.locator('svg.lucide-heart') });
    this.favoriteIcon = this.favoriteButton.locator('svg.lucide-heart');
    this.rateButton = this.root.locator('[class*="rating-btn"]');
    const volumeControl = this.root.locator('[class*="volume-control-container"]');
    this.volumeSlider = volumeControl.locator('input[type="range"]');
    this.muteButton = volumeControl.locator('button');
    this.audio = page.locator('audio');
  }

  @step('Click Play / Pause in the player bar')
  async togglePlayPause(): Promise<void> {
    await this.playPauseButton.click();
  }

  @step('Click Next in the player bar')
  async next(): Promise<void> {
    await this.nextButton.click();
  }

  @step('Click Previous in the player bar')
  async previous(): Promise<void> {
    await this.previousButton.click();
  }

  @step('Click Shuffle in the player bar')
  async toggleShuffle(): Promise<void> {
    await this.shuffleButton.click();
  }

  @step('Click Repeat in the player bar')
  async cycleRepeat(): Promise<void> {
    await this.repeatButton.click();
  }

  /**
   * Moves the playing song to one second before its end, so the end-of-song behavior (auto-advance, repeat) can
   * be checked without listening to the whole song. The audio element is moved directly: how the seek bar should
   * behave is still open (US-013-AC-10), and the song's length is only known once the browser has loaded it.
   */
  @step('Move the playing song to its last second')
  async moveNearEnd(): Promise<void> {
    await this.audio.evaluate(async (element: HTMLAudioElement) => {
      if (!Number.isFinite(element.duration) || element.duration <= 0) {
        await new Promise((resolve) => element.addEventListener('loadedmetadata', resolve, { once: true }));
      }
      element.currentTime = element.duration - 1;
    });
  }

  @step((level: number) => `Set the player volume slider to ${Math.round(level * 100)}%`)
  async setVolume(level: number): Promise<void> {
    await this.volumeSlider.fill(String(level));
  }

  /** Mutes when sound is on, unmutes when muted. */
  @step('Click Mute / Unmute in the player bar')
  async toggleMute(): Promise<void> {
    await this.muteButton.click();
  }

  /** Volume actually applied to the audio element (0–1), the oracle behind the slider. */
  async audioVolume(): Promise<number> {
    return this.audio.evaluate((element: HTMLAudioElement) => element.volume);
  }

  @step('Click the heart in the player bar')
  async toggleFavorite(): Promise<void> {
    await this.favoriteButton.click();
  }

  @step('Click the rate button in the player bar')
  async rate(): Promise<void> {
    await this.rateButton.click();
  }

  /** True while the audio element is playing and its position has moved past 0. */
  async isPlaying(): Promise<boolean> {
    return this.audio.evaluate((element: HTMLAudioElement) => !element.paused && element.currentTime > 0);
  }

  async isPaused(): Promise<boolean> {
    return this.audio.evaluate((element: HTMLAudioElement) => element.paused);
  }

  /** Playback position of the audio element, in seconds. */
  async audioPosition(): Promise<number> {
    return this.audio.evaluate((element: HTMLAudioElement) => element.currentTime);
  }

  /** MP3 the audio element is loading or playing. */
  async audioSource(): Promise<string> {
    return this.audio.evaluate((element: HTMLAudioElement) => element.src);
  }
}
