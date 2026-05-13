import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePerm } from '@/middleware/auth.js';
import { setOrgContext } from '@/middleware/orgContext.js';
import {
  CreatePolicySchema,
  DecidePtoSchema,
  RequestPtoSchema,
} from '@/modules/pto/pto.schemas.js';
import {
  createPolicy,
  decidePto,
  getBalances,
  listPolicies,
  listRequests,
  requestPto,
} from '@/modules/pto/pto.service.js';
import { getPrisma } from '@/lib/prisma.js';
import { env } from '@/config/env.js';

export const ptoRouter: Router = Router();
ptoRouter.use(requireAuth, setOrgContext);

ptoRouter.get('/policies', requirePerm('pto.request'), async (req: Request, res: Response) => {
  const policies = await listPolicies(req.user!.org);
  res.json({ policies });
});

ptoRouter.post(
  '/policies',
  requirePerm('pto.policy.manage'),
  async (req: Request, res: Response) => {
    const input = CreatePolicySchema.parse(req.body);
    const policy = await createPolicy(req.user!.org, input, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.status(201).json({ policy });
  },
);

ptoRouter.post(
  '/requests',
  requirePerm('pto.request'),
  async (req: Request, res: Response) => {
    const input = RequestPtoSchema.parse(req.body);
    const prisma = getPrisma();
    const org = await prisma.organization.findUnique({ where: { id: req.user!.org } });
    const tz = org?.timezone ?? env.DEFAULT_TIMEZONE;
    const request = await requestPto(req.user!.org, tz, input, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.status(201).json({ request });
  },
);

const ListQuerySchema = z.object({
  employeeId: z.string().cuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
});

ptoRouter.get(
  '/requests',
  requirePerm('pto.approve.team'),
  async (req: Request, res: Response) => {
    const query = ListQuerySchema.parse(req.query);
    const requests = await listRequests(req.user!.org, query);
    res.json({ requests });
  },
);

ptoRouter.post(
  '/requests/:id/decision',
  requirePerm('pto.approve.team'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.id);
    const { decision, note } = DecidePtoSchema.parse(req.body);
    const request = await decidePto(req.user!.org, id, decision, note, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.json({ request });
  },
);

ptoRouter.get(
  '/balances/:employeeId',
  requirePerm('employee.read.team'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.employeeId);
    const balances = await getBalances(req.user!.org, id);
    res.json({ balances });
  },
);
