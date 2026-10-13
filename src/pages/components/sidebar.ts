import type { Locator, Page } from '@playwright/test';
import { uiText } from '../../data/messages';
import { step } from '../../reporting/step';

/** Left navigation (`Sidebar.jsx`, rendered as `<aside>`). */
export class Sidebar {
  /** In-app link to Home (`/`). */
  readonly discoverLink: Locator;
  /** Navigates for members; opens the "Start Listening" modal for guests. */
  readonly favoritesLink: Locator;

  constructor(page: Page) {
    const sidebar = page.getByRole('complementary');
    this.discoverLink = sidebar.getByRole('link', { name: uiText.discover, exact: true });
    this.favoritesLink = sidebar.getByRole('link', { name: 'Favorites', exact: true });
  }

  @step('Open Discover (Home) from the sidebar')
  async openDiscover(): Promise<void> {
    await this.discoverLink.click();
  }

  @step('Open Favorites from the sidebar')
  async openFavorites(): Promise<void> {
    await this.favoritesLink.click();
  }
}
