import type { Locator, Page } from '@playwright/test';
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

  constructor(page: Page) {
    this.root = page.getByRole('banner');
    this.loginButton = this.root.getByRole('button', { name: 'Login', exact: true });
    this.userMenuButton = this.root.locator('button[class*="user-avatar"]');
    this.logoutButton = this.root.getByRole('button', { name: 'Logout', exact: true });
  }

  @step('Log out from the user menu')
  async logout(): Promise<void> {
    await this.userMenuButton.click();
    await this.logoutButton.click();
  }
}
