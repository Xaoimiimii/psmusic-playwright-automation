import type { Locator, Page } from '@playwright/test';
import { uiText } from '../data/messages';

/**
 * `/song/:id` (`SongViewPage.jsx`), a public page.
 *
 * The page has no test ids and no links: artist names are clickable spans,
 * classes are CSS-module hashed (matched by their readable part), and the heart
 * and star are non-interactive divs. Everything is scoped to the page container
 * because `main` also holds up to three copies of the player controls.
 * Collapsed lyrics and song lists keep every row in the DOM (CSS `max-height`
 * only), so the collapsed state is read from the container class.
 */
export class SongPage {
  readonly title: Locator;
  readonly cover: Locator;
  /** The artist line under the title: one span per artist, or the joined name when `/artists` is empty. */
  readonly artistLine: Locator;
  readonly artistNames: Locator;
  readonly favoriteCounter: Locator;
  readonly reviewCounter: Locator;
  readonly heartIcon: Locator;
  readonly starIcon: Locator;
  /** Reads "Play", or "Pause" while this song is the one playing. */
  readonly playButton: Locator;
  readonly downloadButton: Locator;
  readonly lyricsScroller: Locator;
  readonly lyricLines: Locator;
  readonly lyricsToggle: Locator;
  readonly noLyricsMessage: Locator;
  readonly artistsHeading: Locator;
  readonly artistRows: Locator;
  readonly otherSongsSection: Locator;
  readonly otherSongsHeading: Locator;
  readonly otherSongsList: Locator;
  /** One title button per row of "Other songs by …". */
  readonly otherSongTitles: Locator;
  readonly otherSongsToggle: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.title = main.getByRole('heading', { level: 1 });

    const view = main.locator('[class*="song-view-container"]');
    this.cover = view.locator('img[class*="song-cover"]');
    this.artistLine = view.locator('p[class*="song-artist"]');
    this.artistNames = this.artistLine.locator('[class*="artist-link"]');

    const counters = view.locator('[class*="action-buttons"] > [class*="icon-button"]');
    this.favoriteCounter = counters.nth(0).locator('span');
    this.reviewCounter = counters.nth(1).locator('span');
    this.heartIcon = counters.nth(0).locator('svg');
    this.starIcon = counters.nth(1).locator('svg');

    const playButtons = view.locator('[class*="play-buttons"]');
    this.playButton = playButtons.locator('button[class*="btn-play"]');
    this.downloadButton = playButtons.getByRole('button', { name: uiText.download });

    const lyricsCard = view.locator('[class*="lyrics-card"]');
    this.lyricsScroller = lyricsCard.locator('[class*="lyrics-content-scroller"]');
    this.lyricLines = this.lyricsScroller.locator('p[class*="lyric-line"]');
    this.lyricsToggle = lyricsCard.locator('button[class*="btn-toggle-lyrics"]');
    this.noLyricsMessage = this.lyricsScroller.getByText(uiText.noLyrics, { exact: true });

    const artistList = view.locator('[class*="artist-list"]');
    this.artistsHeading = artistList.getByRole('heading', { name: uiText.artists, exact: true });
    this.artistRows = artistList.locator('[class*="artist-row"]');

    this.otherSongsSection = view.locator('[class*="other-songs-section"]');
    this.otherSongsHeading = this.otherSongsSection.getByRole('heading', { level: 2 });
    this.otherSongsList = this.otherSongsSection.locator('[class*="song-list-wrapper"]');
    this.otherSongTitles = this.otherSongsList.locator('button[class*="sr-title-songtab"]');
    this.otherSongsToggle = this.otherSongsSection.locator('button[class*="btn-toggle-songs"]');
  }

  async open(songId: number): Promise<void> {
    await this.page.goto(`/song/${songId}`);
  }

  async toggleLyrics(): Promise<void> {
    await this.lyricsToggle.click();
  }

  async toggleOtherSongs(): Promise<void> {
    await this.otherSongsToggle.click();
  }

  async play(): Promise<void> {
    await this.playButton.click();
  }

  /** Rendered height of the "Other songs" list, which is what collapse changes. */
  async otherSongsListHeight(): Promise<number> {
    return (await this.otherSongsList.boundingBox())?.height ?? 0;
  }
}
