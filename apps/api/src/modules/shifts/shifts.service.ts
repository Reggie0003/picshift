/**
 * Shift management.
 *
 * Times are always stored as UTC in the database. Display tz is the
 * organization's tz (default Africa/Accra). The `claim` action uses an
 * optimistic check-and-update so two concurrent requests don't both succeed.
 */
import type { Prisma, Shift } from '@prisma/client';
import { getPrisma } from '@/lib/prisma.js';
import { ApiError } from '@/lib/errors.js';
import { recordAudit } from '@/modules/audit/audit.service.js';
import type { CreateShiftInput } from '@/modules/shifts/shifts.schemas.js';

export async function createShift(
  orgId: string,
  creatorUserId: string,
  input: CreateShiftInput,
  actor: { ip: string | null; userAgent: string | null; requestId: string },
): Promise<Shift> {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (end <= start) throw ApiError.badRequest('endTime must be after startTime');
  if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) {
    throw ApiError.badRequest('Shift cannot exceed 24 hours');
  }

  const prisma = getPrisma();
  const shift = await prisma.shift.create({
    data: {
      organizationId: orgId,
      title: input.title,
      description: input.description ?? null,
      startTime: start,
      endTime: end,
      location: input.location ?? null,
      createdById: creatorUserId,
      assignedEmployeeId: input.assignedEmployeeId ?? null,
      status: input.assignedEmployeeId ? 'assigned' : 'open',
    },
  });

  await recordAudit({
    organizationId: orgId,
    actorId: creatorUserId,
    action: 'create',
    entityType: 'shift',
    entityId: shift.id,
    after: { title: shift.title, startTime: shift.startTime, endTime: shift.endTime },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });

  return shift;
}

export interface ListShiftsArgs {
  orgId: string;
  status?: 'open' | 'claimed' | 'assigned' | 'completed' | 'cancelled';
  from?: Date;
  to?: Date;
  assignedUserId?: string;
}

export async function listShifts(args: ListShiftsArgs): Promise<Shift[]> {
  const prisma = getPrisma();
  const where: Prisma.ShiftWhereInput = { organizationId: args.orgId };
  if (args.status) where.status = args.status;
  if (args.from) where.startTime = { gte: args.from };
  if (args.to) {
    where.endTime = { ...(where.endTime as Prisma.DateTimeFilter | undefined), lte: args.to };
  }
  if (args.assignedUserId) where.assignedUserId = args.assignedUserId;

  return prisma.shift.findMany({
    where,
    orderBy: [{ startTime: 'asc' }],
    take: 500,
  });
}

/**
 * Claim a shift atomically. We use a conditional update: only update if
 * status='open' AND assignedUserId IS NULL. If 0 rows are affected, somebody
 * beat us to it.
 */
export async function claimShift(
  orgId: string,
  shiftId: string,
  userId: string,
  actor: { ip: string | null; userAgent: string | null; requestId: string },
): Promise<Shift> {
  const prisma = getPrisma();
  const result = await prisma.shift.updateMany({
    where: {
      id: shiftId,
      organizationId: orgId,
      status: 'open',
      assignedUserId: null,
    },
    data: {
      assignedUserId: userId,
      status: 'claimed',
    },
  });
  if (result.count === 0) {
    throw ApiError.conflict('Shift no longer available');
  }
  const shift = await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });

  await recordAudit({
    organizationId: orgId,
    actorId: userId,
    action: 'update',
    entityType: 'shift',
    entityId: shiftId,
    metadata: { event: 'claim' },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });

  return shift;
}

export async function deleteShift(
  orgId: string,
  shiftId: string,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string },
): Promise<void> {
  const prisma = getPrisma();
  const before = await prisma.shift.findFirst({ where: { id: shiftId, organizationId: orgId } });
  if (!before) throw ApiError.notFound();

  await prisma.shift.delete({ where: { id: shiftId } });

  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'delete',
    entityType: 'shift',
    entityId: shiftId,
    before: { title: before.title, startTime: before.startTime },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });
}

export async function clockIn(
  orgId: string,
  shiftId: string,
  userId: string,
): Promise<Shift> {
  const prisma = getPrisma();
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, organizationId: orgId, assignedUserId: userId },
  });
  if (!shift) throw ApiError.notFound();
  if (shift.clockedInAt) throw ApiError.conflict('Already clocked in');
  return prisma.shift.update({
    where: { id: shiftId },
    data: { clockedInAt: new Date() },
  });
}

export async function clockOut(
  orgId: string,
  shiftId: string,
  userId: string,
): Promise<Shift> {
  const prisma = getPrisma();
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, organizationId: orgId, assignedUserId: userId },
  });
  if (!shift) throw ApiError.notFound();
  if (!shift.clockedInAt) throw ApiError.badRequest('Must clock in first');
  if (shift.clockedOutAt) throw ApiError.conflict('Already clocked out');
  return prisma.shift.update({
    where: { id: shiftId },
    data: { clockedOutAt: new Date(), status: 'completed' },
  });
}
