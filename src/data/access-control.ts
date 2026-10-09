import type { ApiEndpoint, RequestCredentials } from '../api/api-request';
import { authRoutes } from '../api/auth-api';
import { songRoutes } from '../api/song-api';
import { statsRoutes } from '../api/stats-api';
import { catalog } from './catalog';

/**
 * Endpoints and credential variants for the access-control scenarios
 * (TS-AUTHZ-01, TS-AUTHZ-02). Every endpoint and response below was observed
 * against the local API on 2026-10-08 (`docs/exploration/browser/authorization.md`).
 */

export interface NamedEndpoint extends ApiEndpoint {
  name: string;
}

const song = catalog.songWithMedia;

/** Body of every service-key rejection (`ApiAuthMiddleware.cs`). */
export const serviceKeyRejection = { message: 'Unauthorized Access' } as const;

/** A public and a protected endpoint: the middleware runs before routing, so one of each is enough. */
export const serviceKeyEndpoints: NamedEndpoint[] = [
  { name: 'public song detail', method: 'GET', route: songRoutes.detail(song) },
  { name: 'protected favorites', method: 'GET', route: songRoutes.favorites },
];

export const serviceKeyVariants: { case: string; credentials: RequestCredentials }[] = [
  { case: 'without the service key', credentials: { serviceKey: null } },
  { case: 'with a wrong service key', credentials: { serviceKey: 'wrong-service-key' } },
];

/** The `[Authorize]` endpoints named by TS-AUTHZ-02. A 401 is returned before any body is read, so none is sent. */
export const protectedEndpoints: NamedEndpoint[] = [
  { name: 'favorites list', method: 'GET', route: songRoutes.favorites },
  { name: 'favorite toggle', method: 'POST', route: songRoutes.favoriteToggle(song) },
  { name: 'stream recording', method: 'POST', route: songRoutes.stream(song) },
  { name: 'add review', method: 'POST', route: songRoutes.addReview(song) },
  { name: 'heartbeat', method: 'POST', route: statsRoutes.heartbeat },
  { name: 'own profile', method: 'GET', route: authRoutes.me },
];

/** Not a JWT, so bearer validation fails. */
export const INVALID_ACCESS_TOKEN = 'invalid-access-token';

export const bearerVariants: { case: string; credentials: RequestCredentials }[] = [
  { case: 'without a token', credentials: {} },
  { case: 'with an invalid token', credentials: { accessToken: INVALID_ACCESS_TOKEN } },
];

/** Optional-user endpoint: reads the token when it is valid, otherwise serves a guest. */
export const optionalUserEndpoint: NamedEndpoint = { name: 'song detail', method: 'GET', route: songRoutes.detail(song) };
