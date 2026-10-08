import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';
import type { Credentials, NewUser } from '../data/users';

/** Route paths of the auth endpoints (`AuthController.cs`, `[Route("api/auth")]`). */
export const authRoutes = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
} as const;

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Body of login and refresh. `token` and `user` are present only on success. */
export interface AuthResponseBody {
  isSuccess: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
}

/** Parsed body of a login or refresh response, from the API client or captured in the browser. */
export async function authBody(response: { json(): Promise<unknown> }): Promise<AuthResponseBody> {
  return (await response.json()) as AuthResponseBody;
}

/** Stands in for the access token in `withoutToken()`. */
export const REDACTED_TOKEN = '<redacted>';

/**
 * The body with the access token replaced by `REDACTED_TOKEN`. Match against this
 * instead of the raw body, so a failure message never prints the token.
 */
export function withoutToken(body: AuthResponseBody): AuthResponseBody {
  return body.token === undefined ? body : { ...body, token: REDACTED_TOKEN };
}

/**
 * Client for `/api/auth/*`. Every call carries the `X-App-Service-Key` header.
 * Cookies (the HttpOnly `RefreshToken`) live in the jar of the request context
 * passed in: a standalone context for API tests, or `browserContext.request`
 * to share the cookie with the browser.
 */
export class AuthApi {
  constructor(private readonly request: APIRequestContext) {}

  register(user: NewUser): Promise<APIResponse> {
    return this.request.post(this.url(authRoutes.register), {
      headers: this.headers(),
      data: {
        username: user.username,
        password: user.password,
        email: user.email,
        displayName: user.username,
        avatarURL: null,
      },
    });
  }

  login(credentials: Credentials): Promise<APIResponse> {
    return this.request.post(this.url(authRoutes.login), {
      headers: this.headers(),
      data: { username: credentials.username, password: credentials.password },
    });
  }

  refresh(): Promise<APIResponse> {
    return this.request.post(this.url(authRoutes.refresh), { headers: this.headers() });
  }

  logout(accessToken: string): Promise<APIResponse> {
    return this.request.post(this.url(authRoutes.logout), {
      headers: this.headers({ Authorization: `Bearer ${accessToken}` }),
    });
  }

  /** Registers the user and fails loudly if the API refuses, so tests never start from a missing account. */
  async registerOrThrow(user: NewUser): Promise<void> {
    const response = await this.register(user);
    if (!response.ok()) {
      throw new Error(`Test setup: register ${user.username} failed with ${response.status()} ${await response.text()}`);
    }
  }

  /** Logs in and returns the body; fails loudly on any non-success. */
  async loginOrThrow(credentials: Credentials): Promise<AuthResponseBody> {
    const response = await this.login(credentials);
    const body = await authBody(response);
    if (!response.ok() || !body.isSuccess) {
      throw new Error(`Test setup: login ${credentials.username} failed with ${response.status()} ${body.message}`);
    }
    return body;
  }

  private url(route: string): string {
    return new URL(route, env.apiBaseUrl).href;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'X-App-Service-Key': env.serviceKey, ...extra };
  }
}
