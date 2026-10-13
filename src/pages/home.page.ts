import type { Locator, Page } from '@playwright/test';
import { uiText } from '../data/messages';
import { step } from '../reporting/step';

/**
 * `/` (`HomePage.jsx`). Each section renders only when its popular data (last 7 days) is not empty, so the genre
 * tiles depend on the environment's recent listening (`docs/exploration/browser/pages-and-locators.md` §4).
 */
export class HomePage {
  readonly genreSectionHeading: Locator;
  /** "Discover by Genre" tiles (at most 8): a link to `/category/:id` holding the cover and an `h3` with the genre name. */
  readonly genreTiles: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.genreSectionHeading = main.getByRole('heading', { name: uiText.discoverByGenre, level: 2 });
    this.genreTiles = main.locator('a[href^="/category/"]');
  }

  @step('Open Home')
  async open(): Promise<void> {
    await this.page.goto('/');
  }

  /** Opens the genre of the tile at `index` and returns its displayed name. */
  @step((index: number) => `Open genre tile ${index + 1} on Home`)
  async openGenre(index: number): Promise<string> {
    const tile = this.genreTiles.nth(index);
    const name = (await tile.locator('h3').innerText()).trim();
    await tile.click();
    return name;
  }
}
