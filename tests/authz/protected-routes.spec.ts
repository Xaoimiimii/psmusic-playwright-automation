import { authBody, authRoutes } from '../../src/api/auth-api';
import { appUrl } from '../../src/config/env';
import { uiText } from '../../src/data/messages';
import { test, expect } from '../../src/fixtures/test';
import { nextApiResponse } from '../../src/support/network';

const protectedPaths = ['/favorites', '/recent'] as const;

test.describe('US-016-AC-07 / US-020-AC-04 protected routes', () => {
  test('TS-AUTHZ-06 guest opening a protected URL is sent to /auth', { tag: ['@smoke', '@critical'] }, async ({
    page,
    authPage,
  }) => {
    for (const path of protectedPaths) {
      await test.step(path, async () => {
        const refreshResponse = nextApiResponse(page, 'POST', authRoutes.refresh);
        await page.goto(path);
        expect((await authBody(await refreshResponse)).isSuccess, 'session check finished as guest').toBe(false);
        await expect(page).toHaveURL(appUrl(authPage.path));
        await expect(authPage.loginForm).toBeVisible();
      });
    }
  });

  test('TS-AUTHZ-06 member opening a protected URL sees the page', { tag: ['@critical'] }, async ({
    page,
    header,
    favoritesPage,
    recentPage,
    member,
  }) => {
    await test.step('/favorites shows the Favorite Playlist page', async () => {
      await favoritesPage.open();
      await expect(header.userMenuButton).toBeVisible();
      await expect(favoritesPage.content).toBeVisible();
      await expect(page).toHaveURL(appUrl(favoritesPage.path));
    });

    await test.step('/recent shows only the placeholder', async () => {
      await recentPage.open();
      await expect(recentPage.placeholder).toBeVisible();
      await expect(recentPage.content).toHaveText(uiText.recentPlaceholder);
      await expect(page).toHaveURL(appUrl(recentPage.path));
    });
  });
});
