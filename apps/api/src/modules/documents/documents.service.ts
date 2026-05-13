/**
 * Document storage flow:
 *
 *   1. POST /documents/init    → server returns presigned PUT URL + key
 *   2. Client uploads bytes directly to S3
 *   3. POST /documents/finalize → server marks the doc available + records sha256
 *
 * Why this flow: the API never sees file bytes (cheap + scalable), and clients
 * can't smuggle data into the bucket because we control the key namespace.
 *
 * Retention: documents are tagged with retentionUntil. A nightly job (TODO)
 * deletes expired documents; tax records (Ghana ITA §125) get a 6-year minimum.
 */
import { ulid } from 'ulid';
import type { Document } from '@prisma/client';
import { getPrisma } from '@/lib/prisma.js';
import { presignDownload, presignUpload } from '@/lib/s3.js';
import { env } from '@/config/env.js';
import { ApiError } from '@/lib/errors.js';
import { recordAudit } from '@/modules/audit/audit.service.js';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200);
}

export interface InitUploadInput {
  orgId: string;
  uploaderUserId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  category: string;
  employeeId?: string;
  retentionUntil?: string;
}

export async function initUpload(input: InitUploadInput): Promise<{
  uploadUrl: string;
  documentId: string;
  s3Key: string;
}> {
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw ApiError.unprocessable(`Content-type ${input.contentType} not allowed`);
  }

  const prisma = getPrisma();
  const id = ulid();
  const sanitized = safeFilename(input.filename);
  const s3Key = `org/${input.orgId}/${input.category}/${id}/${sanitized}`;

  const doc = await prisma.document.create({
    data: {
      organizationId: input.orgId,
      employeeId: input.employeeId ?? null,
      uploadedById: input.uploaderUserId,
      category: input.category as Document['category'],
      filename: sanitized,
      contentType: input.contentType,
      sizeBytes: BigInt(input.sizeBytes),
      s3Key,
      sha256: 'pending',
      isEncryptedAtRest: true,
      retentionUntil: input.retentionUntil ? new Date(input.retentionUntil) : null,
      scanStatus: 'pending',
    },
  });

  const uploadUrl = await presignUpload({
    bucket: env.S3_BUCKET_DOCUMENTS,
    key: s3Key,
    contentType: input.contentType,
    contentLength: input.sizeBytes,
    metadata: { docId: doc.id, orgId: input.orgId },
  });

  return { uploadUrl, documentId: doc.id, s3Key };
}

export async function finalizeUpload(args: {
  orgId: string;
  documentId: string;
  sha256: string;
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string };
}): Promise<Document> {
  const prisma = getPrisma();
  const doc = await prisma.document.findFirst({
    where: { id: args.documentId, organizationId: args.orgId },
  });
  if (!doc) throw ApiError.notFound();
  if (doc.sha256 !== 'pending') throw ApiError.conflict('Document already finalized');

  const updated = await prisma.document.update({
    where: { id: args.documentId },
    data: { sha256: args.sha256, scanStatus: 'pending' },
  });

  await recordAudit({
    organizationId: args.orgId,
    actorId: args.actor.userId,
    action: 'create',
    entityType: 'document',
    entityId: doc.id,
    after: { filename: doc.filename, category: doc.category, sha256: args.sha256 },
    ipAddress: args.actor.ip,
    userAgent: args.actor.userAgent,
    requestId: args.actor.requestId,
  });

  return updated;
}

export async function getDownloadUrl(orgId: string, documentId: string): Promise<{
  url: string;
  filename: string;
  contentType: string;
}> {
  const prisma = getPrisma();
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: orgId, deletedAt: null },
  });
  if (!doc) throw ApiError.notFound();
  if (doc.scanStatus === 'infected') {
    throw ApiError.forbidden('This document was flagged by malware scanning');
  }
  const url = await presignDownload({ bucket: env.S3_BUCKET_DOCUMENTS, key: doc.s3Key });
  return { url, filename: doc.filename, contentType: doc.contentType };
}

export async function listDocuments(orgId: string, opts: { employeeId?: string; category?: string }) {
  const prisma = getPrisma();
  return prisma.document.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      ...(opts.category ? { category: opts.category as Document['category'] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
