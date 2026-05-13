/**
 * Attaches a per-request id and a structured logger to req for traceability.
 * The request id is also returned in the X-Request-Id response header so
 * clients can include it in bug reports.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ulid } from 'ulid';
import { logger } from '@/lib/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    log: typeof logger;
  }
}

export const requestContext: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[A-Za-z0-9_-]{8,128}$/.test(incoming) ? incoming : ulid();
  req.id = id;
  req.log = logger.child({ requestId: id });
  res.setHeader('x-request-id', id);
  next();
};
