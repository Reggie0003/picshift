/**
 * Express app composition. Kept separate from server.ts so it can be
 * imported by integration tests without binding to a port.
 */
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { corsOrigins, env, isProd } from '@/config/env.js';
import { logger } from '@/lib/logger.js';
import { requestContext } from '@/middleware/requestContext.js';
import { globalLimiter } from '@/middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import { registerRoutes } from '@/routes/index.js';

export function buildApp(): Express {
  const app = express();

  // Trust the first proxy (Cloudflare → nginx → API). Required for
  // express-rate-limit and accurate client IP in audit logs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.disable('etag');

  // -- Security headers -----------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'", env.APP_URL, env.API_PUBLIC_URL],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // -- CORS -----------------------------------------------------------------
  app.use(
    cors({
      origin: (origin, callback) => {
        // Server-to-server / curl: allow when no Origin header
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Org-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );

  // -- Parsers, logging, context -------------------------------------------
  app.use(cookieParser());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).id,
      customLogLevel: (_req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
      },
    }),
  );

  // -- Rate limiting --------------------------------------------------------
  app.use(globalLimiter);

  // -- Health (no auth) -----------------------------------------------------
  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // -- API routes -----------------------------------------------------------
  registerRoutes(app);

  // -- 404 + error handler --------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
