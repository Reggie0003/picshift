import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePerm } from '@/middleware/auth.js';
import { setOrgContext } from '@/middleware/orgContext.js';
import { getPrisma } from '@/lib/prisma.js';
import { recordAudit } from '@/modules/audit/audit.service.js';

export const auditRouter: Router = Router();
auditRouter.use(requireAuth, setOrgContext);

const ListQuery = z.object({
  action: z
    .enum([
      'create',
      'update',
      'delete',
      'login',
      'logout',
      'login_failed',
      'mfa_enrolled',
      'mfa_verified',
      'permission_change',
      'password_reset',
      'data_export',
      'data_erasure',
      'payroll_run',
      'payment_dispatched',
      'webhook_received',
      'consent_granted',
      'consent_revoked',
    ])
    .optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(60).optional(),
  actorId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

auditRouter.get(
  '/',
  requirePerm('audit.read'),
  async (req: Request, res: Response) => {
    const q = ListQuery.parse(req.query);
    const prisma = getPrisma();

    const where = {
      organizationId: req.user!.org,
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLogEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.auditLogEntry.count({ where }),
    ]);

    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  },
);

auditRouter.get(
  '/export.csv',
  requirePerm('audit.export'),
  async (req: Request, res: Response) => {
    const q = ListQuery.parse(req.query);
    const prisma = getPrisma();

    const items = await prisma.auditLogEntry.findMany({
      where: {
        organizationId: req.user!.org,
        ...(q.from || q.to
          ? {
              createdAt: {
                ...(q.from ? { gte: new Date(q.from) } : {}),
                ...(q.to ? { lte: new Date(q.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });

    const header = 'id,createdAt,actorId,action,entityType,entityId,ipAddress';
    const rows = items.map((i) =>
      [
        i.id,
        i.createdAt.toISOString(),
        i.actorId ?? '',
        i.action,
        i.entityType,
        i.entityId ?? '',
        i.ipAddress ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    await recordAudit({
      organizationId: req.user!.org,
      actorId: req.user!.sub,
      action: 'data_export',
      entityType: 'audit_log',
      metadata: { count: items.length },
      ipAddress: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
    res.send([header, ...rows].join('\n'));
  },
);
