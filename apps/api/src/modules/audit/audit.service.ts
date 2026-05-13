/**
 * Audit log writer. Every privileged action MUST go through this service.
 *
 * The audit_log table is INSERT-only — Postgres triggers (migration 0002)
 * reject any UPDATE or DELETE. That gives us tamper-evident evidence for
 * SOC 2 audits and Ghana Data Protection Commission inquiries.
 */
import type { Request } from 'express';
import { getPrisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'mfa_enrolled'
  | 'mfa_verified'
  | 'permission_change'
  | 'password_reset'
  | 'data_export'
  | 'data_erasure'
  | 'payroll_run'
  | 'payment_dispatched'
  | 'webhook_received'
  | 'consent_granted'
  | 'consent_revoked';

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.auditLogEntry.create({
      data: {
        organizationId: entry.organizationId ?? null,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId ?? null,
        metadata: (entry.metadata ?? null) as never,
      },
    });
  } catch (err) {
    // Audit failures must never break the user-facing operation, but they
    // need loud alerting so SREs can investigate.
    logger.error({ err, entry }, 'audit_log_write_failed');
  }
}

export function fromRequest(
  req: Request,
  partial: Omit<AuditEntry, 'ipAddress' | 'userAgent' | 'requestId' | 'organizationId' | 'actorId'> & {
    organizationId?: string | null;
    actorId?: string | null;
  },
): AuditEntry {
  return {
    ...partial,
    organizationId: partial.organizationId ?? req.user?.org ?? null,
    actorId: partial.actorId ?? req.user?.sub ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    requestId: req.id,
  };
}
