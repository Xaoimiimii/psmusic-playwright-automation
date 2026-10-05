import type { Locator, Page } from '@playwright/test';

/** `/song/:id` (`SongViewPage.jsx`), a public page. */
export class SongPage {
  readonly title: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('main').getByRole('heading', { level: 1 });
  }

  async open(songId: number): Promise<void> {
    await this.page.goto(`/song/${songId}`);
  }
}
