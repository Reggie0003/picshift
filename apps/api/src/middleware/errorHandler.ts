/**
 * Central error handler. Converts thrown errors into safe JSON responses
 * and ensures stack traces never leak to clients in production.
 *
 * Important: this is the LAST middleware registered.
 */
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/errors.js';
import { isProd } from '@/config/env.js';
import { logger } from '@/lib/logger.js';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'UNPROCESSABLE',
        message: 'Validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      },
      requestId: req.id,
    });
    return;
  }

  // Known API errors → their status
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.path, method: req.method, requestId: req.id }, err.message);
    }
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
      requestId: req.id,
    });
    return;
  }

  // Unknown errors → 500 with no stack leak in prod
  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error(
    { err, path: req.path, method: req.method, requestId: req.id },
    'unhandled error',
  );
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: isProd ? 'Internal server error' : message,
    },
    requestId: req.id,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    requestId: req.id,
  });
};
