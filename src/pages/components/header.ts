import type { Locator, Page } from '@playwright/test';
import { uiText } from '../../data/messages';
import { step } from '../../reporting/step';

/**
 * Top bar (`Header.jsx`, `UserDropdown.jsx`). While the session check runs the
 * header shows neither Login nor the avatar; afterwards exactly one of them.
 */
export class Header {
  readonly root: Locator;
  /** Guest only. */
  readonly loginButton: Locator;
  /** Signed-in only. Icon button without an accessible name, so a partial CSS-module class is the only hook (fragile). */
  readonly userMenuButton: Locator;
  readonly logoutButton: Locator;
  /** Header search: suggestions for 2+ characters after a 300 ms pause, Enter opens `/search?q=`. */
  readonly searchInput: Locator;
  /** X button, rendered while the input has text. */
  readonly clearSearchButton: Locator;
  /** Shown while the input is focused and not blank: loading text, "No suitable suggestions", or the suggestions. */
  readonly suggestionBox: Locator;
  /** One button per suggestion: the top result first, then artists, then songs. Navigates on mouse down. */
  readonly suggestions: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('banner');
    this.loginButton = this.root.getByRole('button', { name: 'Login', exact: true });
    this.userMenuButton = this.root.locator('button[class*="user-avatar"]');
    this.logoutButton = this.root.getByRole('button', { name: 'Logout', exact: true });
    const searchBar = this.root.locator('[class*="search-bar"]');
    this.searchInput = searchBar.getByPlaceholder(uiText.searchPlaceholder);
    this.clearSearchButton = searchBar.locator('button[class*="clear-button"]');
    this.suggestionBox = searchBar.locator('[class*="suggestBox"]');
    this.suggestions = this.suggestionBox.getByRole('button');
  }

  @step('Log out from the user menu')
  async logout(): Promise<void> {
    await this.userMenuButton.click();
    await this.logoutButton.click();
  }

  /**
   * Types key by key, as a user does, so each keystroke restarts the typing pause. The field keeps its text after a
   * navigation, so it is cleared first unless `append` is set.
   */
  @step((text: string) => `Type "${text}" in the header search`)
  async typeSearch(text: string, { append = false } = {}): Promise<void> {
    if (!append) await this.searchInput.clear();
    await this.searchInput.click();
    await this.searchInput.pressSequentially(text);
  }

  @step('Press Enter in the header search')
  async submitSearch(): Promise<void> {
    await this.searchInput.press('Enter');
  }

  /**
   * Clicks a suggestion, then waits until the box has closed: the input loses focus and `Header.jsx` marks it
   * unfocused 150 ms later, which would otherwise undo a focus given within that window.
   */
  @step((title: string) => `Choose the suggestion "${title}"`)
  async chooseSuggestion(title: string): Promise<void> {
    await this.suggestions.filter({ hasText: title }).first().click();
    await this.suggestionBox.waitFor({ state: 'hidden' });
  }

  @step('Clear the header search with the X button')
  async clearSearch(): Promise<void> {
    await this.clearSearchButton.click();
  }
}
