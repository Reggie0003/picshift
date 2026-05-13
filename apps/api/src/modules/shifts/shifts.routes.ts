import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePerm } from '@/middleware/auth.js';
import { setOrgContext } from '@/middleware/orgContext.js';
import {
  CreateShiftSchema,
  ListShiftsQuerySchema,
} from '@/modules/shifts/shifts.schemas.js';
import {
  claimShift,
  clockIn,
  clockOut,
  createShift,
  deleteShift,
  listShifts,
} from '@/modules/shifts/shifts.service.js';

export const shiftsRouter: Router = Router();
shiftsRouter.use(requireAuth, setOrgContext);

shiftsRouter.get('/', async (req: Request, res: Response) => {
  const q = ListShiftsQuerySchema.parse(req.query);
  const shifts = await listShifts({
    orgId: req.user!.org,
    status: q.status,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    assignedUserId: q.assignedTo,
  });
  res.json({ shifts });
});

shiftsRouter.post(
  '/',
  requirePerm('shift.create'),
  async (req: Request, res: Response) => {
    const input = CreateShiftSchema.parse(req.body);
    const shift = await createShift(req.user!.org, req.user!.sub, input, {
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.status(201).json({ shift });
  },
);

shiftsRouter.post(
  '/:id/claim',
  requirePerm('shift.claim'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.id);
    const shift = await claimShift(req.user!.org, id, req.user!.sub, {
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.json({ shift });
  },
);

shiftsRouter.post('/:id/clock-in', async (req: Request, res: Response) => {
  const id = z.string().cuid().parse(req.params.id);
  const shift = await clockIn(req.user!.org, id, req.user!.sub);
  res.json({ shift });
});

shiftsRouter.post('/:id/clock-out', async (req: Request, res: Response) => {
  const id = z.string().cuid().parse(req.params.id);
  const shift = await clockOut(req.user!.org, id, req.user!.sub);
  res.json({ shift });
});

shiftsRouter.delete(
  '/:id',
  requirePerm('shift.delete'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.id);
    await deleteShift(req.user!.org, id, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.status(204).end();
  },
);
