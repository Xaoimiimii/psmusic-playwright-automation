import type { Locator, Page } from '@playwright/test';

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
  /** A `div`, not a button; its `lucide-heart` icon is the only stable hook. */
  readonly favoriteButton: Locator;
  readonly rateButton: Locator;
  /** The single `<audio>` element of `PlayerContext`; it stays mounted on `/auth`. */
  private readonly audio: Locator;

  constructor(page: Page) {
    this.root = page.locator('[class*="playerWrapper"] [class*="player-controls-new"]');
    this.favoriteButton = this.root
      .locator('[class*="player-main-row"] [class*="icon-button"]')
      .filter({ has: page.locator('svg.lucide-heart') });
    this.rateButton = this.root.locator('[class*="rating-btn"]');
    this.audio = page.locator('audio');
  }

  async toggleFavorite(): Promise<void> {
    await this.favoriteButton.click();
  }

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
}
