import type { Locator, Page } from '@playwright/test';
import { step } from '../reporting/step';

/**
 * `/charts` (`TopChartsPage.jsx`): one ranked chart per popular genre (at most 10), the first two side by side.
 * Each chart: an `h2` "Top <genre>", a See all link to `/category/:id` and up to 10 rows. Song titles are buttons
 * (no `href`); artist names are clickable spans that open `/artist/:id` (`docs/exploration/browser/discovery.md`).
 */
export class ChartsPage {
  readonly path = '/charts';
  readonly chartHeadings: Locator;
  /** See all link of each chart, in page order: its `href` holds the genre id. */
  readonly chartLinks: Locator;
  readonly favoriteIcons: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.chartHeadings = main.getByRole('heading', { level: 2, name: /^Top / });
    this.chartLinks = main.locator('a[href^="/category/"]');
    this.favoriteIcons = main.locator('svg.lucide-heart');
  }

  @step('Open Charts')
  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** The chart under the heading at `index`: its nearest container that also holds the rows. */
  chart(index: number): Locator {
    return this.chartHeadings.nth(index).locator('xpath=ancestor::*[.//*[contains(@class,"_row_")]][1]');
  }

  ranks(index: number): Promise<string[]> {
    return this.chart(index).locator('[class*="rankColumn"]').allInnerTexts();
  }

  songTitles(index: number): Locator {
    return this.chart(index).locator('button[class*="sr-title-songtab"]');
  }

  artistNames(index: number): Locator {
    return this.chart(index).locator('span[class*="artistName"]');
  }

  /** Genre ids of the charts, in page order, read from their See all links. */
  async genreIds(): Promise<number[]> {
    const hrefs = await this.chartLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    return hrefs.map((href) => Number(href.split('/').pop()));
  }

  /** Opens the first song of chart `index` and returns its displayed title. */
  @step((index: number) => `Open the first song of chart ${index + 1}`)
  async openFirstSong(index: number): Promise<string> {
    const title = (await this.songTitles(index).first().innerText()).trim();
    await this.songTitles(index).first().click();
    return title;
  }

  /** Opens the first artist name of chart `index`; returns the name without its ", " separator. */
  @step((index: number) => `Open the first artist of chart ${index + 1}`)
  async openFirstArtist(index: number): Promise<string> {
    const name = (await this.artistNames(index).first().innerText()).replace(/,\s*$/, '').trim();
    await this.artistNames(index).first().click();
    return name;
  }
}
