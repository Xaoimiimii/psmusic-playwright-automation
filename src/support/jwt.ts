/** Claims of a PSMusic refresh token (`TokenGenerator.GenerateRefreshToken`). */
export interface RefreshTokenClaims {
  sub: string;
  token_type: string;
  /** Seconds since epoch. */
  iat: number;
  exp: number;
}

/**
 * Reads the payload of a JWT without verifying it. The signature is the
 * server's concern; tests only need the claims it issued (user, type, expiry).
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Not a JWT');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
}
