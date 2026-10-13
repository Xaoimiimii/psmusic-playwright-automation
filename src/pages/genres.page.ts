import type { Locator, Page } from '@playwright/test';
import { uiText } from '../data/messages';
import { step } from '../reporting/step';

/**
 * `/genres` (`ExploreCategoriesPage.jsx`): one section per genre with song cards (`ItemCardColumn`). Each card has a
 * play overlay `button[aria-label="Play"]`, about 40 per page (`docs/exploration/browser/pages-and-locators.md` §5).
 */
export class GenresPage {
  readonly path = '/genres';
  readonly songCardPlayButtons: Locator;

  constructor(private readonly page: Page) {
    this.songCardPlayButtons = page.getByRole('main').getByRole('button', { name: uiText.play, exact: true });
  }

  @step('Open Genres & Topics')
  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** The first card is top left, clear of the recommendation popup (bottom right). */
  @step('Play the first song card on Genres & Topics')
  async playFirstSongCard(): Promise<void> {
    await this.songCardPlayButtons.first().click();
  }
}
