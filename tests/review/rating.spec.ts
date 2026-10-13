import { songRoutes } from '../../src/api/song-api';
import { catalog } from '../../src/data/catalog';
import { ratingText } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';
import { answerReviewSubmit, reportSongAsReviewed } from '../../src/support/controlled-responses';
import { requestBarrier } from '../../src/support/network';
import { playFromSongPage } from '../../src/support/playback';

/** Rate button state once the user has reviewed the song (`PlayerControl.jsx` adds the `rated` module class). */
const RATED = /_rated_/;

// Every test is a fresh member who plays song 1 and opens the rating modal from the player bar. Reviews are
// permanent (TR-01), so nothing is submitted to the server: submits and the "already reviewed" flag are
// answered in the browser, and the server half of TS-REV-02 / TS-REV-04 waits for the write environment (D-WR).
test.describe('US-017 Rate and review a song', () => {
  test.beforeEach(async ({ header, songPage, listeningMember }) => {
    await songPage.open(catalog.songWithMedia);
    await expect(header.userMenuButton, `precondition: signed in as ${listeningMember.username}`).toBeVisible();
  });

  test('TS-REV-01 rating form for a user who has not reviewed', { tag: ['@critical'] }, async ({
    page,
    songPage,
    playerBar,
    ratingModal,
    apiTraffic,
  }) => {
    const { player } = await playFromSongPage(page, songPage, catalog.songWithMedia);
    await expect(playerBar.rateButton).not.toHaveClass(RATED);
    const mark = apiTraffic.mark();

    await playerBar.rate();

    await test.step('the form offers 5 stars, an optional comment and a disabled submit', async () => {
      await expect(ratingModal.heading).toHaveText(`${ratingText.headingPrefix} "${player.title}"`);
      await expect(ratingModal.formStars).toHaveCount(5);
      expect(await ratingModal.formStarsFilled(), 'no star chosen').toBe(0);
      await expect(ratingModal.commentInput).toBeVisible();
      await expect(ratingModal.commentInput).toHaveValue('');
      await expect(ratingModal.submitButton).toBeDisabled();
      await expect(ratingModal.communityHeading).toBeVisible();
    });

    await test.step('choosing 1 star enables submit', async () => {
      await ratingModal.chooseStars(1);
      await expect.poll(() => ratingModal.formStarsFilled()).toBe(1);
      await expect(ratingModal.submitButton).toBeEnabled();
    });

    await test.step('choosing 5 stars selects all five', async () => {
      await ratingModal.chooseStars(5);
      await expect.poll(() => ratingModal.formStarsFilled()).toBe(5);
      await expect(ratingModal.submitButton).toBeEnabled();
    });

    await test.step('nothing was submitted', async () => {
      await requestBarrier(page);
      expect(apiTraffic.after(mark, 'POST', songRoutes.addReview(catalog.songWithMedia))).toEqual([]);
    });
  });

  test('TS-REV-02 submitting a review', {
    tag: ['@critical'],
    annotation: {
      type: 'pending-data',
      description:
        'UI half only. Persistence in the API review list waits for the write environment (D-WR, TR-01). The review ' +
        'count is not asserted: the player keeps it in state only and no screen shows it.',
    },
  }, async ({ page, songPage, playerBar, ratingModal, listeningMember }) => {
    const songId = catalog.songWithMedia;
    const comment = `Playwright review ${test.info().testId}`;
    const submit = await answerReviewSubmit(page, songId);
    await playFromSongPage(page, songPage, songId);
    await playerBar.rate();
    await expect(ratingModal.submitButton).toBeDisabled();

    await ratingModal.chooseStars(4);
    await ratingModal.writeComment(comment);
    await ratingModal.submit();

    await test.step('the modal posts the rating, the comment and the username', async () => {
      expect(await submit.sent).toEqual({ rating: 4, comment, user: listeningMember.username });
    });

    await test.step('the review is first in the list and the form is gone', async () => {
      await expect.poll(() => ratingModal.review(0)).toEqual({ author: listeningMember.username, comment, stars: 4 });
      await expect(ratingModal.submitButton).toHaveCount(0);
      await expect(ratingModal.formStars).toHaveCount(0);
    });

    await test.step('the rate button shows the rated state', async () => {
      await expect(playerBar.rateButton).toHaveClass(RATED);
    });
  });

  test('TS-REV-04 rated state for a user who already reviewed', {
    tag: ['@critical'],
    annotation: {
      type: 'pending-data',
      description: 'UI half only: isReviewed:true after a real review waits for the write environment (D-WR, TR-01).',
    },
  }, async ({ page, songPage, playerBar, ratingModal }) => {
    await reportSongAsReviewed(page, catalog.songWithMedia);
    await playFromSongPage(page, songPage, catalog.songWithMedia);

    await expect(playerBar.rateButton).toHaveClass(RATED);

    await playerBar.rate();
    await expect(ratingModal.communityHeading).toBeVisible();
    await expect(ratingModal.reviews.first()).toBeVisible();
    await expect(ratingModal.submitButton, 'no second review offered').toHaveCount(0);
    await expect(ratingModal.formStars).toHaveCount(0);
    await expect(ratingModal.commentInput).toHaveCount(0);
  });
});
