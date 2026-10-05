import { randomBytes } from 'node:crypto';

export interface Credentials {
  username: string;
  password: string;
}

export interface NewUser extends Credentials {
  email: string;
}

/** Minimum password length enforced by the login and sign-up forms. */
export const MIN_PASSWORD_LENGTH = 8;

function runUniqueId(): string {
  return `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}

/**
 * A run-unique user for API registration. Usernames stay well under the
 * 30-character display-name limit (TS-REG-07); `@example.com` is accepted by
 * the API (the deliverability check is UI-only).
 */
export function buildUser(): NewUser {
  const username = `pwqa_${runUniqueId()}`;
  return {
    username,
    email: `${username}@example.com`,
    password: `Pw-${randomBytes(6).toString('hex')}`,
  };
}

/** A username that has never been registered. */
export function unknownUsername(): string {
  return `pwqa_none_${runUniqueId()}`;
}

export function passwordOfLength(length: number): string {
  return 'p'.repeat(length);
}
