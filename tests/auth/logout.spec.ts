import { authBody, authRoutes } from '../../src/api/auth-api';
import { appUrl } from '../../src/config/env';
import { test, expect } from '../../src/fixtures/test';
import { catalog } from '../../src/data/catalog';
import { serverMessage } from '../../src/data/messages';
import { knownDefect } from '../../src/support/known-defect';
import { nextApiResponse } from '../../src/support/network';
import { refreshCookie } from '../../src/support/session';

test.describe('US-004 Log out', () => {
  test.describe('TS-AUTH-10 logout lands on Home from every page', () => {
    test('from a protected page (/favorites)', { tag: ['@critical'] }, async ({ page, context, header, favoritesPage, member }) => {
      await favoritesPage.open();
      await expect(favoritesPage.content).toBeVisible();

      await header.logout();
      await expect.poll(() => refreshCookie(context), { message: 'signed out' }).toBeUndefined();

      knownDefect('US-004-AC-01', 'logout from /favorites lands on /auth instead of /');
      await expect(page).toHaveURL(appUrl('/'));
      await expect(header.loginButton).toBeVisible();
    });

    test('from a public page (/song/:id)', { tag: ['@critical'] }, async ({ page, header, songPage, member }) => {
      await songPage.open(catalog.songWithMedia);
      await expect(songPage.title).toBeVisible();
      await expect(header.userMenuButton).toBeVisible();

      await header.logout();

      await expect(header.loginButton).toBeVisible();
      await expect(page).toHaveURL(appUrl('/'));
    });
  });

  test('TS-AUTH-11 logout clears the session', { tag: ['@critical'] }, async ({ page, context, header, member }) => {
    await page.goto('/');
    await expect(header.userMenuButton).toBeVisible();

    await test.step('API: logout succeeds and the refresh cookie is deleted', async () => {
      const logoutResponse = nextApiResponse(page, 'POST', authRoutes.logout);
      await header.logout();
      const response = await logoutResponse;
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ isSuccess: true, message: serverMessage.logoutSuccess });
      await expect.poll(() => refreshCookie(context), { message: 'RefreshToken cookie removed' }).toBeUndefined();
    });

    await test.step('UI: still a guest after a reload', async () => {
      const refreshResponse = nextApiResponse(page, 'POST', authRoutes.refresh);
      await page.reload();
      expect((await authBody(await refreshResponse)).isSuccess).toBe(false);
      await expect(header.loginButton).toBeVisible();
      await expect(header.userMenuButton).toBeHidden();
    });
  });
});
