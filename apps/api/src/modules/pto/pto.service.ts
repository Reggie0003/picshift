/**
 * PTO service.
 *
 * Ghana Labour Act 2003 (Act 651) defaults baked in:
 *   - §20: 15 working days annual leave per year (after 12 months)
 *   - §57: 12 weeks paid maternity leave (84 calendar days)
 *   - §10: at least 36 hours weekly rest
 *
 * Nigeria Labour Act 1990 defaults (informational):
 *   - §18: 6 working days annual leave per year (after 12 months)
 *   - Maternity Leave Act: 12 weeks (84 days)
 *
 * Working-day calculation excludes weekends. Public holidays should be
 * applied via OrganizationHoliday (future enhancement).
 */
import { DateTime } from 'luxon';
import type { PtoRequest, PtoRequestStatus } from '@prisma/client';
import { getPrisma } from '@/lib/prisma.js';
import { ApiError } from '@/lib/errors.js';
import { recordAudit } from '@/modules/audit/audit.service.js';
import type { CreatePolicyInput, RequestPtoInput } from '@/modules/pto/pto.schemas.js';

export const GHANA_LABOUR_ACT_DEFAULTS = {
  annualLeaveWorkingDays: 15,
  maternityCalendarWeeks: 12,
  paternityCalendarDays: 0, // not statutory in Ghana; many employers offer 5–10
  bereavementCalendarDays: 3,
  sickLeaveDaysPaid: 12,
} as const;

export const NIGERIA_LABOUR_ACT_DEFAULTS = {
  annualLeaveWorkingDays: 6,
  maternityCalendarWeeks: 12,
  paternityCalendarDays: 14, // public-sector federal circular
  bereavementCalendarDays: 3,
  sickLeaveDaysPaid: 12,
} as const;

export function workingDaysBetween(startISO: string, endISO: string, tz: string): number {
  const start = DateTime.fromISO(startISO, { zone: tz });
  const end = DateTime.fromISO(endISO, { zone: tz });
  if (!start.isValid || !end.isValid) {
    throw ApiError.badRequest('Invalid start/end date');
  }
  if (end < start) {
    throw ApiError.badRequest('End date must be on or after start date');
  }
  let days = 0;
  let cur = start.startOf('day');
  const last = end.startOf('day');
  while (cur <= last) {
    const wd = cur.weekday; // 1 = Mon, 7 = Sun
    if (wd >= 1 && wd <= 5) days += 1;
    cur = cur.plus({ days: 1 });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export async function createPolicy(
  orgId: string,
  input: CreatePolicyInput,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string },
) {
  const prisma = getPrisma();
  const policy = await prisma.ptoPolicy.create({
    data: {
      organizationId: orgId,
      name: input.name,
      category: input.category,
      defaultDaysPerYear: input.defaultDaysPerYear,
      accrualMethod: input.accrualMethod,
      carryOverDays: input.carryOverDays,
      maxBalanceDays: input.maxBalanceDays ?? null,
      requiresApproval: input.requiresApproval,
      appliesToTypes: input.appliesToTypes,
    },
  });
  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'create',
    entityType: 'pto_policy',
    entityId: policy.id,
    after: { name: policy.name, category: policy.category },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });
  return policy;
}

export async function listPolicies(orgId: string) {
  const prisma = getPrisma();
  return prisma.ptoPolicy.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function seedDefaultPolicies(orgId: string, country: string) {
  const prisma = getPrisma();
  const isGh = country === 'GH';
  const def = isGh ? GHANA_LABOUR_ACT_DEFAULTS : NIGERIA_LABOUR_ACT_DEFAULTS;

  await prisma.ptoPolicy.createMany({
    data: [
      {
        organizationId: orgId,
        name: 'Annual Leave',
        category: 'annual',
        defaultDaysPerYear: def.annualLeaveWorkingDays,
        accrualMethod: 'anniversary',
        carryOverDays: 5,
        requiresApproval: true,
        appliesToTypes: ['full_time'],
      },
      {
        organizationId: orgId,
        name: 'Sick Leave',
        category: 'sick',
        defaultDaysPerYear: def.sickLeaveDaysPaid,
        accrualMethod: 'calendar',
        requiresApproval: false,
        appliesToTypes: ['full_time', 'part_time'],
      },
      {
        organizationId: orgId,
        name: 'Maternity Leave',
        category: 'maternity',
        defaultDaysPerYear: def.maternityCalendarWeeks * 7,
        accrualMethod: 'calendar',
        requiresApproval: true,
        appliesToTypes: ['full_time', 'part_time'],
      },
      {
        organizationId: orgId,
        name: 'Bereavement',
        category: 'bereavement',
        defaultDaysPerYear: def.bereavementCalendarDays,
        accrualMethod: 'calendar',
        requiresApproval: true,
        appliesToTypes: ['full_time', 'part_time'],
      },
    ],
    skipDuplicates: true,
  });
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function requestPto(
  orgId: string,
  tz: string,
  input: RequestPtoInput,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string },
): Promise<PtoRequest> {
  const prisma = getPrisma();
  const policy = await prisma.ptoPolicy.findFirst({
    where: { id: input.policyId, organizationId: orgId, isActive: true },
  });
  if (!policy) throw ApiError.notFound('PTO policy not found');

  const employee = await prisma.employeeProfile.findFirst({
    where: { id: input.employeeId, organizationId: orgId, deletedAt: null },
  });
  if (!employee) throw ApiError.notFound('Employee not found');

  const days = workingDaysBetween(input.startDate, input.endDate, tz);
  if (days <= 0) throw ApiError.badRequest('Request must include at least one working day');

  // Check current balance for the policy's current period (calendar year for now)
  const periodStart = DateTime.now().setZone(tz).startOf('year').toJSDate();
  const periodEnd = DateTime.now().setZone(tz).endOf('year').toJSDate();

  const balance = await prisma.ptoBalance.findFirst({
    where: { employeeId: input.employeeId, policyId: input.policyId, periodStart },
  });

  const accrued = balance ? Number(balance.accruedDays) : Number(policy.defaultDaysPerYear);
  const taken = balance ? Number(balance.takenDays) : 0;
  const pending = balance ? Number(balance.pendingDays) : 0;
  const available = accrued + Number(balance?.carriedOverDays ?? 0) - taken - pending;

  if (policy.category === 'annual' && days > available) {
    throw ApiError.unprocessable(
      `Insufficient balance: requested ${days} day(s), available ${available.toFixed(2)}`,
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.ptoRequest.create({
      data: {
        organizationId: orgId,
        employeeId: input.employeeId,
        policyId: input.policyId,
        requesterId: actor.userId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        daysRequested: days,
        reason: input.reason ?? null,
        status: policy.requiresApproval ? 'pending' : 'approved',
        decidedAt: policy.requiresApproval ? null : new Date(),
      },
    });

    await tx.ptoBalance.upsert({
      where: {
        employeeId_policyId_periodStart: {
          employeeId: input.employeeId,
          policyId: input.policyId,
          periodStart,
        },
      },
      create: {
        employeeId: input.employeeId,
        policyId: input.policyId,
        periodStart,
        periodEnd,
        accruedDays: policy.defaultDaysPerYear,
        pendingDays: days,
      },
      update: { pendingDays: { increment: days } },
    });

    return req;
  });

  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'create',
    entityType: 'pto_request',
    entityId: created.id,
    after: { days, policy: policy.name, status: created.status },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });

  return created;
}

export async function decidePto(
  orgId: string,
  requestId: string,
  decision: 'approve' | 'reject',
  note: string | undefined,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string },
): Promise<PtoRequest> {
  const prisma = getPrisma();
  const req = await prisma.ptoRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
  });
  if (!req) throw ApiError.notFound();
  if (req.status !== 'pending') {
    throw ApiError.conflict(`Request is already ${req.status}`);
  }

  const newStatus: PtoRequestStatus = decision === 'approve' ? 'approved' : 'rejected';

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.ptoRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        approverId: actor.userId,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      },
    });

    if (decision === 'approve') {
      await tx.ptoBalance.updateMany({
        where: { employeeId: req.employeeId, policyId: req.policyId },
        data: {
          pendingDays: { decrement: req.daysRequested },
          takenDays: { increment: req.daysRequested },
        },
      });
    } else {
      await tx.ptoBalance.updateMany({
        where: { employeeId: req.employeeId, policyId: req.policyId },
        data: { pendingDays: { decrement: req.daysRequested } },
      });
    }

    return r;
  });

  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'update',
    entityType: 'pto_request',
    entityId: requestId,
    metadata: { decision, note: note ?? null },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });

  return updated;
}

export async function listRequests(orgId: string, opts: { employeeId?: string; status?: PtoRequestStatus }) {
  const prisma = getPrisma();
  return prisma.ptoRequest.findMany({
    where: {
      organizationId: orgId,
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  });
}

export async function getBalances(orgId: string, employeeId: string) {
  const prisma = getPrisma();
  const employee = await prisma.employeeProfile.findFirst({
    where: { id: employeeId, organizationId: orgId },
  });
  if (!employee) throw ApiError.notFound();

  return prisma.ptoBalance.findMany({
    where: { employeeId },
    include: { policy: true },
    orderBy: { periodStart: 'desc' },
  });
}
