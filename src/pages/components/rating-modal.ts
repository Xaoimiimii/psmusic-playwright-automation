import type { Locator, Page } from '@playwright/test';
import { ratingText } from '../../data/messages';
import { step } from '../../reporting/step';

/** Fill of a selected (or hovered) star, in the form and in the review list (`RatingModal.jsx`). */
const FILLED_STAR = '#FFD700';

/**
 * Rating modal opened by a member from the player bar's Rate button (`RatingModal.jsx`).
 * Vietnamese only, no `role="dialog"`, no test ids; the stars are bare lucide `svg`s
 * (`docs/exploration/browser/pages-and-locators.md` §12). The form is not rendered at
 * all once the user has reviewed the song: only the review list is.
 */
export class RatingModal {
  readonly root: Locator;
  readonly heading: Locator;
  /** The five stars of the form, 1 to 5 from left to right. */
  readonly formStars: Locator;
  readonly commentInput: Locator;
  readonly submitButton: Locator;
  readonly communityHeading: Locator;
  /** One per review, newest first; a review just posted is prepended. */
  readonly reviews: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.root = page.locator('[class*="rating-modal"]');
    this.heading = this.root.getByRole('heading', { level: 3 });
    this.formStars = this.root.locator('[class*="star-rating"]:not([class*="star-rating-display"]) svg');
    this.commentInput = this.root.getByPlaceholder(ratingText.commentPlaceholder);
    this.submitButton = this.root.getByRole('button', { name: ratingText.submit, exact: true });
    this.communityHeading = this.root.getByRole('heading', { name: ratingText.communityReviews, exact: true });
    this.reviews = this.root.locator('[class*="review-item"]');
    this.closeButton = this.root.locator('button[class*="close-btn"]');
  }

  @step((stars: number) => `Choose ${stars} star${stars === 1 ? '' : 's'} in the rating form`)
  async chooseStars(stars: number): Promise<void> {
    await this.formStars.nth(stars - 1).click();
  }

  @step('Write a comment in the rating form')
  async writeComment(comment: string): Promise<void> {
    await this.commentInput.fill(comment);
  }

  @step('Submit the review')
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Number of form stars drawn as selected. The pointer still hovers the last star clicked, which shows the same value. */
  formStarsFilled(): Promise<number> {
    return filledStars(this.formStars);
  }

  /** Author, comment and number of filled stars of the review at `index` (0 = first in the list). */
  async review(index: number): Promise<{ author: string; comment: string; stars: number }> {
    const item = this.reviews.nth(index);
    return {
      author: (await item.locator('strong').innerText()).trim(),
      comment: (await item.locator('p[class*="review-comment"]').innerText()).trim(),
      stars: await filledStars(item.locator('[class*="star-rating-display"] svg')),
    };
  }
}

async function filledStars(stars: Locator): Promise<number> {
  const fills = await stars.evaluateAll((icons) => icons.map((icon) => icon.getAttribute('fill')));
  return fills.filter((fill) => fill === FILLED_STAR).length;
}
