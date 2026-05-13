/**
 * Authentication & authorisation middleware.
 *
 *   requireAuth         — verifies the access token and attaches req.user
 *   requireMfa          — additionally requires the session to have completed MFA
 *   requirePerm(perm)   — additionally requires the user has a specific permission
 *
 * The token is read from `Authorization: Bearer <jwt>`. Refresh-token cookies
 * are handled separately by /auth/refresh.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/jwt.js';
import { ApiError } from '@/lib/errors.js';
import { hasPermission, type Permission } from '@/lib/rbac.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AccessTokenPayload;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractBearer(req);
    if (!token) throw ApiError.unauthorized('Missing or malformed Authorization header');
    const payload = await verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireMfa: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.mfa) return next(ApiError.mfaRequired());
  next();
};

export function requirePerm(perm: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!hasPermission(req.user.roles, perm)) {
      return next(ApiError.insufficientPermissions(`Missing permission: ${perm}`));
    }
    next();
  };
}

export function requireAnyPerm(perms: readonly Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const ok = perms.some((p) => hasPermission(req.user!.roles, p));
    if (!ok) {
      return next(
        ApiError.insufficientPermissions(`Missing one of: ${perms.join(', ')}`),
      );
    }
    next();
  };
}
