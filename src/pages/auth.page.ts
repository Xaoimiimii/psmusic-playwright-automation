import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '../data/users';

/**
 * `/auth` (`AuthPage.jsx` + `SignIn.jsx`). Both forms are always in the DOM and
 * share `input[name="name"]`, so every form locator is scoped to the form found
 * by its heading (`docs/exploration/browser/pages-and-locators.md` §14).
 */
export class AuthPage {
  readonly path = '/auth';

  readonly loginForm: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  /** Eye icon button; no accessible name, the only `type=button` in the form. */
  readonly passwordVisibilityToggle: Locator;
  readonly loginButton: Locator;
  /** The `<small>` line used for client errors, server errors and the success text. */
  readonly loginMessage: Locator;

  /** Overlay "Welcome Back!" panel button that shows the Create Account form. */
  private readonly showRegisterPanelButton: Locator;
  /** Overlay "Welcome!" panel button that shows the Login form. */
  private readonly showLoginPanelButton: Locator;

  constructor(private readonly page: Page) {
    this.loginForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Login', exact: true }) });
    this.usernameInput = this.loginForm.getByPlaceholder('Username');
    this.passwordInput = this.loginForm.getByPlaceholder('Password');
    this.passwordVisibilityToggle = this.loginForm.locator('button[type="button"]');
    this.loginButton = this.loginForm.getByRole('button', { name: 'Login', exact: true });
    this.loginMessage = this.loginForm.locator('small');

    this.showRegisterPanelButton = this.overlayPanel('Welcome Back!').getByRole('button', { name: 'Register', exact: true });
    this.showLoginPanelButton = this.overlayPanel('Welcome!').getByRole('button', { name: 'Login', exact: true });
  }

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  async enterCredentials(credentials: Credentials): Promise<void> {
    await this.usernameInput.fill(credentials.username);
    await this.passwordInput.fill(credentials.password);
  }

  async submitLogin(): Promise<void> {
    await this.loginButton.click();
  }

  async login(credentials: Credentials): Promise<void> {
    await this.enterCredentials(credentials);
    await this.submitLogin();
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.passwordVisibilityToggle.click();
  }

  async switchToRegisterPanel(): Promise<void> {
    await this.showRegisterPanelButton.click();
  }

  async switchToLoginPanel(): Promise<void> {
    await this.showLoginPanelButton.click();
  }

  /** The overlay panel is the parent of its `<h1>`; overlay buttons are not inside a form. */
  private overlayPanel(heading: string): Locator {
    return this.page.getByRole('heading', { name: heading, exact: true }).locator('xpath=..');
  }
}
