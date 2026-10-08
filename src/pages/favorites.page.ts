import type { Locator, Page } from '@playwright/test';

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

  constructor(private readonly page: Page) {
    this.playlistHeading = page.getByRole('heading', { name: 'Favorite Playlist', level: 1 });
    this.emptyStateMessage = page.getByText('Add your favorite songs to see them here!');
    this.content = this.playlistHeading.or(this.emptyStateMessage);
  }

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** Opens a song page by clicking its title in the playlist (in-app navigation, no page load). */
  async openSong(title: string): Promise<void> {
    await this.page.getByRole('main').getByRole('button', { name: title, exact: true }).first().click();
  }
}
