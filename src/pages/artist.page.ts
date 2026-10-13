import type { Locator, Page } from '@playwright/test';

/** `/artist/:id` (`ArtistPage.jsx`): artist name as `h1`, Play, Main / Collaboration Songs and Related Artists. */
export class ArtistPage {
  readonly name: Locator;

  constructor(page: Page) {
    this.name = page.getByRole('main').getByRole('heading', { level: 1 });
  }
}
