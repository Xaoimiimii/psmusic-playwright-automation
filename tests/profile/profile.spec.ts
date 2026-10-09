import type { MeBody } from '../../src/api/auth-api';
import { test, expect } from '../../src/fixtures/test';
import { knownDefect } from '../../src/support/known-defect';

/** Field names that would carry a password or its hash, in any casing. */
const PASSWORD_FIELD = /pass(word)?|hash/i;

test.describe('US-023 View my profile (provisional)', () => {
  test('TS-PROF-01 a user reads their own profile', {
    tag: ['@critical', '@api'],
    annotation: [
      {
        type: 'pending-decision',
        description: 'Profile endpoint assumed to be GET /api/auth/me (code) until A-Q16 is decided; README names /api/user/profile, which does not exist.',
      },
      {
        type: 'covered-elsewhere',
        description: 'The 401 without a valid token is asserted by TS-AUTHZ-02 (automation-analysis.md §6, overlap #3).',
      },
    ],
  }, async ({ authApi, registeredUser }) => {
    const { token, user } = await authApi.loginOrThrow(registeredUser);

    const response = await authApi.me(token!);
    expect(response.status()).toBe(200);
    const profile = (await response.json()) as MeBody;

    expect(profile).toEqual({
      id: user!.id,
      username: registeredUser.username,
      email: registeredUser.email,
      displayName: registeredUser.username,
    });
    expect(Object.keys(profile).filter((key) => PASSWORD_FIELD.test(key)), 'no password field').toEqual([]);
    expect(JSON.stringify(profile), 'password value not returned').not.toContain(registeredUser.password);
  });

  test('TS-PROF-02 a user cannot read another user\'s profile', {
    tag: ['@critical', '@api'],
    annotation: {
      type: 'pending-decision',
      description: 'The refusal status is not decided; any non-2xx is accepted, and no field of the other user may be returned.',
    },
  }, async ({ authApi, userApi, registeredUser, otherRegisteredUser }) => {
    const { token } = await authApi.loginOrThrow(registeredUser);
    const { user: other } = await authApi.loginOrThrow(otherRegisteredUser);

    const response = await userApi.byId(other!.id, token!);
    const text = await response.text();

    knownDefect('US-023-AC-03', 'GET /api/user/{id} returns any user\'s UserDTO, email included, with 200 (no ownership check; source and runtime 2026-10-08)');
    expect(response.ok(), `refused, got ${response.status()}`).toBe(false);
    expect(text, 'other user\'s email not returned').not.toContain(otherRegisteredUser.email);
    expect(text, 'other user\'s username not returned').not.toContain(otherRegisteredUser.username);
  });
});
