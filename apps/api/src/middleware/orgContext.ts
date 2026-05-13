/**
 * Sets the Postgres session variable `app.current_org_id` so that
 * row-level-security policies enforce tenant isolation as defence-in-depth.
 *
 * Must run AFTER requireAuth so req.user.org is available.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getPrisma } from '@/lib/prisma.js';
import { ApiError } from '@/lib/errors.js';

export const setOrgContext: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) return next(ApiError.unauthorized());
  try {
    const prisma = getPrisma();
    // The function is defined in migration 0001.
    await prisma.$executeRawUnsafe(`SELECT app_set_current_org('${req.user.org.replace(/'/g, "''")}')`);
    next();
  } catch (err) {
    next(err);
  }
};
