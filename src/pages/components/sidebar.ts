import type { Locator, Page } from '@playwright/test';
import { step } from '../../reporting/step';

/** Left navigation (`Sidebar.jsx`, rendered as `<aside>`). */
export class Sidebar {
  /** Navigates for members; opens the "Start Listening" modal for guests. */
  readonly favoritesLink: Locator;

  constructor(page: Page) {
    this.favoritesLink = page.getByRole('complementary').getByRole('link', { name: 'Favorites', exact: true });
  }

  @step('Open Favorites from the sidebar')
  async openFavorites(): Promise<void> {
    await this.favoritesLink.click();
  }
}
