import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';

/** One PSMusic API operation: an HTTP method on a route path. */
export interface ApiEndpoint {
  method: 'GET' | 'POST';
  route: string;
}

/**
 * Credentials sent with a raw request. `serviceKey` defaults to the configured
 * key; `null` leaves the `X-App-Service-Key` header out. `accessToken` adds a
 * bearer token when set.
 */
export interface RequestCredentials {
  serviceKey?: string | null;
  accessToken?: string;
}

/**
 * Sends `endpoint` with exactly the credentials given and no body. Used by the
 * access-control tests, which need to vary or drop headers the API clients
 * always send.
 */
export function sendApiRequest(
  request: APIRequestContext,
  endpoint: ApiEndpoint,
  { serviceKey = env.serviceKey, accessToken }: RequestCredentials = {},
): Promise<APIResponse> {
  const headers: Record<string, string> = {};
  if (serviceKey !== null) headers['X-App-Service-Key'] = serviceKey;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return request.fetch(new URL(endpoint.route, env.apiBaseUrl).href, { method: endpoint.method, headers });
}
