import type { Locator, Page } from '@playwright/test';
import { step } from '../reporting/step';

/**
 * `/category/:id` (`CategoryPage.jsx`): genre name, Featured Artists and Songs, each paged
 * (`docs/exploration/browser/pages-and-locators.md` §7). Song cards link their title to `/song/:id`.
 */
export class CategoryPage {
  readonly name: Locator;
  readonly songLinks: Locator;

  constructor(page: Page) {
    const main = page.getByRole('main');
    this.name = main.getByRole('heading', { level: 1 });
    this.songLinks = main.locator('a[href^="/song/"]');
  }

  /** Opens the song of the card at `index` and returns its id and displayed title. */
  @step((index: number) => `Open song ${index + 1} of the genre`)
  async openSong(index: number): Promise<{ id: number; title: string }> {
    const link = this.songLinks.nth(index);
    const href = await link.getAttribute('href');
    const title = (await link.innerText()).trim();
    await link.click();
    return { id: Number(href?.split('/').pop()), title };
  }
}
