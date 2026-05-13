import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireMfa, requirePerm } from '@/middleware/auth.js';
import { setOrgContext } from '@/middleware/orgContext.js';
import {
  CreateEmployeeSchema,
  ListEmployeesQuerySchema,
  UpdateEmployeeSchema,
} from '@/modules/employees/employees.schemas.js';
import {
  createEmployee,
  eraseEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from '@/modules/employees/employees.service.js';
import { hasPermission } from '@/lib/rbac.js';

export const employeesRouter: Router = Router();

employeesRouter.use(requireAuth, setOrgContext);

employeesRouter.get(
  '/',
  requirePerm('employee.read.team'),
  async (req: Request, res: Response) => {
    const query = ListEmployeesQuerySchema.parse(req.query);
    const mode = hasPermission(req.user!.roles, 'employee.read.all') ? 'admin' : 'manager';
    const result = await listEmployees(req.user!.org, query, mode);
    res.json(result);
  },
);

employeesRouter.get(
  '/:id',
  requirePerm('employee.read.team'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.id);
    const mode = hasPermission(req.user!.roles, 'employee.read.all') ? 'admin' : 'manager';
    const employee = await getEmployee(req.user!.org, id, mode);
    res.json({ employee });
  },
);

employeesRouter.post(
  '/',
  requireMfa,
  requirePerm('employee.write'),
  async (req: Request, res: Response) => {
    const input = CreateEmployeeSchema.parse(req.body);
    const employee = await createEmployee(req.user!.org, input, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.status(201).json({ employee });
  },
);

employeesRouter.patch(
  '/:id',
  requireMfa,
  requirePerm('employee.write'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.id);
    const input = UpdateEmployeeSchema.parse(req.body);
    const employee = await updateEmployee(req.user!.org, id, input, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
    });
    res.json({ employee });
  },
);

const EraseSchema = z.object({
  reason: z.string().min(3).max(500),
  confirm: z.literal(true),
});

employeesRouter.post(
  '/:id/erase',
  requireMfa,
  requirePerm('compliance.erasure.execute'),
  async (req: Request, res: Response) => {
    const id = z.string().cuid().parse(req.params.id);
    const { reason } = EraseSchema.parse(req.body);
    await eraseEmployee(req.user!.org, id, {
      userId: req.user!.sub,
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.id,
      reason,
    });
    res.json({ ok: true });
  },
);
