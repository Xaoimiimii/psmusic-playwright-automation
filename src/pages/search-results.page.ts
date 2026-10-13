import type { Locator, Page } from '@playwright/test';
import { uiText } from '../data/messages';
import { step } from '../reporting/step';

/**
 * `/search?q=` (`SearchResultPage.jsx`): tabs All / Songs / Artists, a "Top result" section for an exact name match,
 * songs and artists. With no song and no top result it shows `No results found for "<keyword>".`
 */
export class SearchResultsPage {
  readonly heading: Locator;
  readonly topResultSection: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { name: uiText.searchResults, level: 1 });
    this.topResultSection = main
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: uiText.topResult, exact: true }) });
  }

  @step((keyword: string) => `Open the search results for "${keyword}"`)
  async open(keyword: string): Promise<void> {
    await this.page.goto(`/search?q=${encodeURIComponent(keyword)}`);
  }

  noResultsMessage(keyword: string): Locator {
    return this.page.getByRole('main').getByText(uiText.noResultsFor(keyword), { exact: true });
  }
}
