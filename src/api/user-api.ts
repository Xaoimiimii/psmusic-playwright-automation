import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';

/** Route paths of the user endpoints (`UserController.cs`, `[Route("api/user")]`). No UI caller. */
export const userRoutes = {
  /** `[Authorize]`; returns `UserDTO` for any id, without an ownership check (source and runtime, 2026-10-08). */
  byId: (userId: number) => `/api/user/${userId}`,
} as const;

/** `UserDTO`. Note `avatarURL`, unlike `avatarUrl` in the login and refresh body. */
export interface UserDto {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarURL: string | null;
}

/** Client for `/api/user/*`. Every call carries the `X-App-Service-Key` header and the caller's bearer token. */
export class UserApi {
  constructor(private readonly request: APIRequestContext) {}

  byId(userId: number, accessToken: string): Promise<APIResponse> {
    return this.request.get(new URL(userRoutes.byId(userId), env.apiBaseUrl).href, {
      headers: { 'X-App-Service-Key': env.serviceKey, Authorization: `Bearer ${accessToken}` },
    });
  }
}
