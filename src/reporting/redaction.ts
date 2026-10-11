import { env } from '../config/env';

/** Stands in for every masked value in report attachments (same marker as `REDACTED_TOKEN` in auth-api.ts). */
export const REDACTED = '<redacted>';

/** Headers whose value is a credential: service key, bearer token, session cookies. */
const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-app-service-key|x-api-key)$/i;

/** JSON keys whose value is a credential, wherever they appear in a request or response body. */
const SECRET_KEY = /pass(word)?|token|secret|api[-_]?key|service[-_]?key|authorization|cookie|credential/i;

/** A JWT (access or refresh token) anywhere in free text. */
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

/**
 * Masks secrets that can appear in free text: JWTs and the configured service key.
 * Last line of defense for console messages, URLs and bodies that are not JSON.
 */
export function redactText(text: string): string {
  let result = text.replace(JWT, REDACTED);
  if (env.serviceKey) result = result.split(env.serviceKey).join(REDACTED);
  return result;
}

/**
 * Header value safe to show. Keeps what helps an investigation (the auth scheme,
 * cookie names and attributes) and drops the credential itself.
 */
export function redactHeader(name: string, value: string): string {
  if (!SECRET_HEADER.test(name)) return redactText(value);
  switch (name.toLowerCase()) {
    case 'authorization':
    case 'proxy-authorization': {
      const scheme = value.split(' ')[0];
      return value.includes(' ') ? `${scheme} ${REDACTED}` : REDACTED;
    }
    case 'set-cookie':
      // "RefreshToken=abc; expires=...; path=/; httponly" -> "RefreshToken=<redacted>; expires=...; path=/; httponly"
      return value
        .split('\n')
        .map((cookie) => cookie.replace(/^([^=;]+)=[^;]*/, `$1=${REDACTED}`))
        .join('\n');
    case 'cookie':
      return value.replace(/([^=;\s]+)=[^;]*/g, `$1=${REDACTED}`);
    default:
      return REDACTED;
  }
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, redactHeader(name, value)]));
}

/** Deep copy of a parsed JSON value with credential fields masked and JWTs removed from every string. */
export function redactJson(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_KEY.test(key) && inner !== null ? REDACTED : redactJson(inner)]),
    );
  }
  return value;
}

/** Cuts long text for an attachment, saying how much was left out. */
export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n… (${text.length - maxLength} more characters not shown)`;
}
