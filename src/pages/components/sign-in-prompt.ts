import type { Locator, Page } from '@playwright/test';
import { uiText } from '../../data/messages';
import { step } from '../../reporting/step';

/**
 * "Start Listening" modal shown to guests on a members-only action (`AuthModal.jsx`).
 * The sidebar and every player-control copy render their own instance, but only
 * an open one is in the DOM, so the heading identifies it. No `role="dialog"`
 * and no test ids (`docs/exploration/browser/pages-and-locators.md` §11).
 */
export class SignInPrompt {
  readonly heading: Locator;
  /** `modalContent`: the card inside the overlay. */
  readonly root: Locator;
  readonly loginNowButton: Locator;
  readonly maybeLaterButton: Locator;
  /** X icon button without an accessible name: the first button of the card. */
  readonly closeIconButton: Locator;
  /** Full-screen backdrop; a click on it outside the card closes the modal. */
  readonly overlay: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: uiText.startListening, exact: true });
    this.root = page.locator('[class*="modalContent"]').filter({ has: this.heading });
    this.loginNowButton = this.root.getByRole('button', { name: uiText.loginNow, exact: true });
    this.maybeLaterButton = this.root.getByRole('button', { name: uiText.maybeLater, exact: true });
    this.closeIconButton = this.root.locator('button').first();
    this.overlay = this.root.locator('xpath=..');
  }

  @step('Close the sign-in prompt with "Maybe Later"')
  async closeWithMaybeLater(): Promise<void> {
    await this.maybeLaterButton.click();
  }

  @step('Close the sign-in prompt with the X icon')
  async closeWithIcon(): Promise<void> {
    await this.closeIconButton.click();
  }

  /** Clicks the backdrop at its top-left corner, which the centered card never covers. */
  @step('Close the sign-in prompt by clicking the backdrop')
  async closeByOverlay(): Promise<void> {
    await this.overlay.click({ position: { x: 10, y: 10 } });
  }

  @step('Choose "Login Now" in the sign-in prompt')
  async loginNow(): Promise<void> {
    await this.loginNowButton.click();
  }

  /** Computed `overflow` of `<body>`: the modal sets it to `hidden` while open and resets it on close. */
  async pageOverflow(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.body).overflow);
  }
}
