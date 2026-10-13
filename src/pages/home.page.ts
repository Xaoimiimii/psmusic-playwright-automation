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
  readonly genreSeeAll: Locator;
  readonly artistSectionHeading: Locator;
  /** Name link of each "Trending Artists" card (at most 10); each card also has an image link without text. */
  readonly artistNameLinks: Locator;
  readonly artistSeeAll: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.genreSectionHeading = main.getByRole('heading', { name: uiText.discoverByGenre, level: 2 });
    this.genreTiles = main.locator('a[href^="/category/"]');
    // `has` is matched inside each section, so it takes a heading locator not rooted at `main`.
    const section = (name: string) =>
      main.locator('section').filter({ has: page.getByRole('heading', { name, level: 2 }) });
    this.genreSeeAll = section(uiText.discoverByGenre).getByRole('link', { name: uiText.seeAll });
    this.artistSectionHeading = main.getByRole('heading', { name: uiText.trendingArtists, level: 2 });
    const artistSection = section(uiText.trendingArtists);
    this.artistNameLinks = artistSection.locator('a[href^="/artist/"]').filter({ hasText: /\S/ });
    this.artistSeeAll = artistSection.getByRole('link', { name: uiText.seeAll });
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

  /** Opens the artist of the card at `index` and returns its id and displayed name. */
  @step((index: number) => `Open trending artist ${index + 1} on Home`)
  async openArtist(index: number): Promise<{ id: number; name: string }> {
    const link = this.artistNameLinks.nth(index);
    const name = (await link.innerText()).trim();
    const id = Number((await link.getAttribute('href'))?.split('/').pop());
    await link.click();
    return { id, name };
  }
}
