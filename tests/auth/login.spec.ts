import { authBody, authRoutes } from '../../src/api/auth-api';
import { appUrl } from '../../src/config/env';
import { test, expect } from '../../src/fixtures/test';
import { clientRejectedLogins, shortestAcceptedLogin, tooShortPasswordLogin } from '../../src/data/login-cases';
import { serverMessage, uiText } from '../../src/data/messages';
import { unknownUsername } from '../../src/data/users';
import { isApiRequest, nextApiResponse } from '../../src/support/network';
import { EXPIRY_TOLERANCE_S, REFRESH_COOKIE, REFRESH_LIFETIME_S, refreshCookie, scriptReadableStorage } from '../../src/support/session';
import { setCookies } from '../../src/support/set-cookie';

test.describe('US-002 Log in', () => {
  test('TS-AUTH-01 valid login creates a session', { tag: ['@smoke', '@critical'] }, async ({
    page,
    context,
    authPage,
    header,
    registeredUser,
  }) => {
    await authPage.open();

    const loginResponse = nextApiResponse(page, 'POST', authRoutes.login);
    // The message is visible only until the SPA navigates to Home 1 s later (`SignIn.jsx`),
    // so the assertion starts polling together with the click instead of after it.
    const successMessageShown = expect(authPage.loginMessage).toHaveText(uiText.loginSuccess);
    await authPage.login(registeredUser);
    const response = await loginResponse;
    const body = await authBody(response);

    await test.step('UI: success message, Home, signed-in header', async () => {
      await successMessageShown;
      await expect(page).toHaveURL(appUrl('/'));
      await expect(header.userMenuButton).toBeVisible();
      await expect(header.loginButton).toBeHidden();
    });

    await test.step('API: token, user and refresh cookie', async () => {
      expect(response.status()).toBe(200);
      expect(body).toMatchObject({
        isSuccess: true,
        message: serverMessage.loginSuccess,
        token: expect.any(String),
        user: {
          id: expect.any(Number),
          username: registeredUser.username,
          email: registeredUser.email,
          displayName: registeredUser.username,
        },
      });

      const cookie = await refreshCookie(context);
      expect(cookie, 'RefreshToken cookie stored by the browser').toBeDefined();
      expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'None', path: '/' });
      const lifetime = cookie!.expires - Date.now() / 1000;
      expect(Math.abs(lifetime - REFRESH_LIFETIME_S)).toBeLessThan(EXPIRY_TOLERANCE_S);
    });

    await test.step('access token is not readable from script storage', async () => {
      expect(await scriptReadableStorage(page)).not.toContain(body.token!);
    });
  });

  test('TS-AUTH-02 login client validation', { tag: ['@regression'] }, async ({ page, authPage }) => {
    const loginRequests: string[] = [];
    page.on('request', (request) => {
      if (isApiRequest(request, 'POST', authRoutes.login)) loginRequests.push(request.url());
    });

    await authPage.open();

    for (const attempt of clientRejectedLogins) {
      await test.step(`${attempt.case} is refused on the client`, async () => {
        await authPage.login(attempt.credentials);
        await expect(authPage.loginMessage).toHaveText(attempt.message);
      });
    }
    expect(loginRequests, 'no login request for client-rejected input').toHaveLength(0);

    await test.step('a password of the minimum length is sent to the API', async () => {
      const loginRequest = page.waitForRequest((request) => isApiRequest(request, 'POST', authRoutes.login));
      await authPage.login(shortestAcceptedLogin());
      await loginRequest;
    });
  });

  test('TS-AUTH-03 unknown username and wrong password', { tag: ['@critical'] }, async ({
    page,
    context,
    authApi,
    authPage,
    registeredUser,
  }) => {
    await test.step('API: unknown username', async () => {
      const response = await authApi.login({ username: unknownUsername(), password: registeredUser.password });
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ isSuccess: false, message: serverMessage.unknownUsername });
      expect(setCookies(response, REFRESH_COOKIE)).toHaveLength(0);
    });

    await test.step('API: existing username, wrong password', async () => {
      const response = await authApi.login({ username: registeredUser.username, password: `${registeredUser.password}x` });
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ isSuccess: false, message: serverMessage.wrongPassword });
      expect(setCookies(response, REFRESH_COOKIE)).toHaveLength(0);
    });

    await test.step('UI: the server message is shown inline and no session starts', async () => {
      await authPage.open();
      await authPage.login({ username: registeredUser.username, password: `${registeredUser.password}x` });
      await expect(authPage.loginMessage).toHaveText(serverMessage.wrongPassword);
      await expect(page).toHaveURL(appUrl(authPage.path));
      expect(await refreshCookie(context)).toBeUndefined();
    });
  });

  test('TS-AUTH-04 password visibility toggle and panel switch', { tag: ['@regression'] }, async ({ authPage }) => {
    await authPage.open();

    await test.step('eye icon shows and hides the password', async () => {
      await expect(authPage.passwordInput).toHaveAttribute('type', 'password');
      await authPage.togglePasswordVisibility();
      await expect(authPage.passwordInput).toHaveAttribute('type', 'text');
      await authPage.togglePasswordVisibility();
      await expect(authPage.passwordInput).toHaveAttribute('type', 'password');
    });

    await test.step('switching to Sign Up and back clears fields, errors and visibility', async () => {
      await authPage.login(tooShortPasswordLogin.credentials);
      await expect(authPage.loginMessage).toHaveText(tooShortPasswordLogin.message);
      await authPage.togglePasswordVisibility();

      await authPage.switchToRegisterPanel();
      await authPage.switchToLoginPanel();

      await expect(authPage.usernameInput).toHaveValue('');
      await expect(authPage.passwordInput).toHaveValue('');
      await expect(authPage.passwordInput).toHaveAttribute('type', 'password');
      await expect(authPage.loginMessage).toBeHidden();
    });
  });
});
