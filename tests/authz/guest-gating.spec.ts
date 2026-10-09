import { songRoutes } from '../../src/api/song-api';
import { appUrl } from '../../src/config/env';
import { catalog } from '../../src/data/catalog';
import { test, expect } from '../../src/fixtures/test';
import { AUDIO_START_TIMEOUT_MS } from '../../src/pages/components/player-bar';
import type { SignInPrompt } from '../../src/pages/components/sign-in-prompt';
import { requestBarrier } from '../../src/support/network';

const closeOptions: { name: string; close: (prompt: SignInPrompt) => Promise<void> }[] = [
  { name: '"Maybe Later"', close: (prompt) => prompt.closeWithMaybeLater() },
  { name: 'the X icon', close: (prompt) => prompt.closeWithIcon() },
  { name: 'a click on the overlay', close: (prompt) => prompt.closeByOverlay() },
];

test.describe('US-014 Sign-in prompt for members-only actions', () => {
  test.beforeEach(async ({ page, header }) => {
    await page.goto('/');
    // Wait for the session check: only then is the visitor known to be a guest.
    await expect(header.loginButton).toBeVisible();
  });

  test('TS-AUTHZ-03 guest clicking Favorites in the sidebar', { tag: ['@critical'] }, async ({
    page,
    sidebar,
    signInPrompt,
  }) => {
    await sidebar.openFavorites();

    await expect(signInPrompt.root).toBeVisible();
    await expect(signInPrompt.loginNowButton).toBeVisible();
    await expect(signInPrompt.maybeLaterButton).toBeVisible();
    await expect(page, 'no navigation to /favorites').toHaveURL(appUrl('/'));
  });

  test('TS-AUTHZ-04 guest clicking heart or rate in the player bar', { tag: ['@critical'] }, async ({
    page,
    songPage,
    playerBar,
    signInPrompt,
    apiTraffic,
  }) => {
    const song = catalog.songWithMedia;
    await songPage.open(song);
    await songPage.play();
    await expect(playerBar.root).toBeVisible();
    await expect
      .poll(() => playerBar.isPlaying(), { message: 'guest playback started', timeout: AUDIO_START_TIMEOUT_MS })
      .toBe(true);
    const start = apiTraffic.mark();

    await test.step('heart opens the prompt', async () => {
      await playerBar.toggleFavorite();
      await expect(signInPrompt.root).toBeVisible();
      await signInPrompt.closeWithMaybeLater();
      await expect(signInPrompt.root).toBeHidden();
    });

    await test.step('rate opens the prompt; "Login Now" opens /auth and pauses the music', async () => {
      await playerBar.rate();
      await expect(signInPrompt.root).toBeVisible();
      await signInPrompt.loginNow();
      await expect(page).toHaveURL(appUrl('/auth'));
      await expect.poll(() => playerBar.isPaused(), { message: 'music paused' }).toBe(true);
    });

    await test.step('no favorite or review request was sent', async () => {
      await requestBarrier(page);
      expect(apiTraffic.after(start, 'POST', songRoutes.favoriteToggle(song))).toEqual([]);
      expect(apiTraffic.after(start, 'POST', songRoutes.addReview(song))).toEqual([]);
    });
  });

  test('TS-AUTHZ-05 closing the sign-in modal', { tag: ['@critical'] }, async ({ page, sidebar, signInPrompt }) => {
    const overflowBefore = await signInPrompt.pageOverflow();
    expect(overflowBefore, 'page scrollable before the modal opens').not.toBe('hidden');

    for (const option of closeOptions) {
      await test.step(`close with ${option.name}`, async () => {
        await sidebar.openFavorites();
        await expect(signInPrompt.root).toBeVisible();
        await expect.poll(() => signInPrompt.pageOverflow(), { message: 'page scroll locked while open' }).toBe('hidden');

        await option.close(signInPrompt);

        await expect(signInPrompt.root).toBeHidden();
        await expect.poll(() => signInPrompt.pageOverflow(), { message: 'page scroll restored' }).toBe(overflowBefore);
        await expect(page).toHaveURL(appUrl('/'));
      });
    }
  });
});
