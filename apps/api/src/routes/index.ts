/**
 * Mounts every module router under /v1. API versioning is intentional —
 * we will breaking-change to /v2 rather than silently break clients.
 */
import type { Express, Request, Response } from 'express';
import { authRouter } from '@/modules/auth/auth.routes.js';
import { employeesRouter } from '@/modules/employees/employees.routes.js';
import { ptoRouter } from '@/modules/pto/pto.routes.js';
import { shiftsRouter } from '@/modules/shifts/shifts.routes.js';
import { documentsRouter } from '@/modules/documents/documents.routes.js';
import { auditRouter } from '@/modules/audit/audit.routes.js';
import { aiRouter } from '@/modules/ai/ai.routes.js';
import { getPrisma } from '@/lib/prisma.js';
import { getRedis } from '@/lib/redis.js';

export function registerRoutes(app: Express): void {
  // Liveness/readiness for orchestrators
  app.get('/readyz', async (_req: Request, res: Response) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      const redis = getRedis();
      await redis.ping();
      res.json({ ok: true });
    } catch (err) {
      res.status(503).json({
        ok: false,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  app.get('/v1', (_req: Request, res: Response) => {
    res.json({
      service: 'picshift-api',
      version: '0.1.0',
      docs: '/docs',
      modules: ['auth', 'employees', 'pto', 'shifts', 'documents', 'audit', 'ai'],
    });
  });

  app.use('/v1/auth', authRouter);
  app.use('/v1/employees', employeesRouter);
  app.use('/v1/pto', ptoRouter);
  app.use('/v1/shifts', shiftsRouter);
  app.use('/v1/documents', documentsRouter);
  app.use('/v1/audit', auditRouter);
  app.use('/v1/ai', aiRouter);
}
