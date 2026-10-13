import type { Locator, Page } from '@playwright/test';
import { uiText } from '../data/messages';
import { step } from '../reporting/step';

/**
 * `/favorites` (`FavoriteSongsPage.jsx`), members only. A user with favorites
 * sees the "Favorite Playlist" heading; a user without favorites sees the
 * `NoFavoriteState` message instead.
 */
export class FavoritesPage {
  readonly path = '/favorites';

  readonly playlistHeading: Locator;
  readonly emptyStateMessage: Locator;
  /** Whichever of the two states rendered: the page finished loading. */
  readonly content: Locator;
  /** Plays the playlist from its first song; reads "Pause" while a playlist song is playing. */
  readonly playAllButton: Locator;

  constructor(private readonly page: Page) {
    this.playlistHeading = page.getByRole('heading', { name: uiText.favoritePlaylist, level: 1 });
    this.emptyStateMessage = page.getByText('Add your favorite songs to see them here!');
    this.content = this.playlistHeading.or(this.emptyStateMessage);
    this.playAllButton = page.getByRole('main').getByRole('button', { name: uiText.playAll, exact: true });
  }

  /** The title button of a playlist row. */
  songTitle(title: string): Locator {
    return this.page.getByRole('main').getByRole('button', { name: title, exact: true });
  }

  @step('Click Play All on the Favorites page')
  async playAll(): Promise<void> {
    await this.playAllButton.click();
  }

  @step('Open the Favorites page')
  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** Opens a song page by clicking its title in the playlist (in-app navigation, no page load). */
  @step((title: string) => `Open song "${title}" from the playlist`)
  async openSong(title: string): Promise<void> {
    await this.page.getByRole('main').getByRole('button', { name: title, exact: true }).first().click();
  }
}
