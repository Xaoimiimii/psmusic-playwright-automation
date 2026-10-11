import type { Locator, Page } from '@playwright/test';
import { uiText } from '../data/messages';
import { step } from '../reporting/step';

/**
 * `/recent`, members only. Today a stub: `App.jsx` renders a bare
 * `<div>Nghe Gần Đây</div>` (hard-coded Vietnamese) as the only page content.
 */
export class RecentPage {
  readonly path = '/recent';

  /** Everything rendered inside `main` for this route. */
  readonly content: Locator;
  readonly placeholder: Locator;

  constructor(private readonly page: Page) {
    this.content = page.getByRole('main');
    this.placeholder = this.content.getByText(uiText.recentPlaceholder, { exact: true });
  }

  @step('Open the Recent page')
  async open(): Promise<void> {
    await this.page.goto(this.path);
  }
}
