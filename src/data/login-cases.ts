import { uiText } from './messages';
import { MIN_PASSWORD_LENGTH, passwordOfLength, unknownUsername, type Credentials } from './users';

/** One character below the minimum: refused on the client with the length message. */
export const tooShortPasswordLogin = {
  case: `password of ${MIN_PASSWORD_LENGTH - 1} characters`,
  credentials: { username: 'any_user', password: passwordOfLength(MIN_PASSWORD_LENGTH - 1) },
  message: uiText.passwordTooShort,
} as const;

/** Inputs the login form rejects on the client, before any request (TS-AUTH-02). */
export const clientRejectedLogins = [
  {
    case: 'empty username',
    credentials: { username: '', password: passwordOfLength(MIN_PASSWORD_LENGTH) },
    message: uiText.fillAllFields,
  },
  {
    case: 'empty password',
    credentials: { username: 'any_user', password: '' },
    message: uiText.fillAllFields,
  },
  tooShortPasswordLogin,
] as const;

/**
 * Smallest password the client lets through to the API. The username was never
 * registered, so the real request has a known outcome on the shared database.
 */
export function shortestAcceptedLogin(): Credentials {
  return { username: unknownUsername(), password: passwordOfLength(MIN_PASSWORD_LENGTH) };
}
