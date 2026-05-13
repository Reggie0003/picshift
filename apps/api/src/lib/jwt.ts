/**
 * JWT issuance and verification using HS256 (symmetric, simpler self-host
 * deployment). For multi-region or third-party verification, switch to RS256
 * by replacing the secret with a private/public key pair.
 *
 * Tokens issued:
 *   - access  (short-lived, ~15 min): used as Bearer token on every request
 *   - refresh (long-lived, ~30 days): rotated on each refresh; stored in DB
 *     (sessions.refreshTokenHash) so we can revoke server-side.
 */
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '@/config/env.js';
import { ApiError } from '@/lib/errors.js';

const ACCESS_KEY = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const REFRESH_KEY = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ISSUER = 'picshift-api';
const AUDIENCE = 'picshift-clients';

export interface AccessTokenPayload {
  sub: string;            // userId
  org: string;            // organizationId
  roles: string[];        // role assignments for this org
  mfa: boolean;           // whether MFA was satisfied for this session
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;            // session id
  org: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL}s`)
    .sign(ACCESS_KEY);
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_TTL}s`)
    .sign(REFRESH_KEY);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_KEY, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.org !== 'string' ||
      !Array.isArray(payload.roles) ||
      typeof payload.mfa !== 'boolean'
    ) {
      throw ApiError.tokenInvalid('Malformed access token');
    }
    return {
      sub: payload.sub,
      org: payload.org,
      roles: payload.roles.filter((r): r is string => typeof r === 'string'),
      mfa: payload.mfa,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && /expired/i.test(err.message)) {
      throw ApiError.tokenExpired();
    }
    throw ApiError.tokenInvalid();
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_KEY, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.org !== 'string'
    ) {
      throw ApiError.tokenInvalid('Malformed refresh token');
    }
    return { sub: payload.sub, sid: payload.sid, org: payload.org };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && /expired/i.test(err.message)) {
      throw ApiError.tokenExpired();
    }
    throw ApiError.tokenInvalid();
  }
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
