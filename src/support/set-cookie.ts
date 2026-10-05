import type { APIResponse } from '@playwright/test';

export interface SetCookie {
  name: string;
  value: string;
  /** Attribute names lower-cased; flag attributes map to `true`. */
  attributes: Record<string, string | true>;
}

function parse(header: string): SetCookie {
  const [pair, ...attributeParts] = header.split(';').map((part) => part.trim());
  const separator = pair.indexOf('=');
  const attributes: Record<string, string | true> = {};
  for (const part of attributeParts) {
    const eq = part.indexOf('=');
    if (eq === -1) attributes[part.toLowerCase()] = true;
    else attributes[part.slice(0, eq).toLowerCase()] = part.slice(eq + 1);
  }
  return { name: pair.slice(0, separator), value: pair.slice(separator + 1), attributes };
}

/** The `Set-Cookie` entries of an API response for one cookie name. */
export function setCookies(response: APIResponse, name: string): SetCookie[] {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => parse(header.value))
    .filter((cookie) => cookie.name === name);
}
