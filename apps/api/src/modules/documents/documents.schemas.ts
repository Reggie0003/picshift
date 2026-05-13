import { z } from 'zod';

export const DocumentCategorySchema = z.enum([
  'id_document',
  'contract',
  'payslip',
  'tax_form',
  'certificate',
  'policy',
  'other',
]);

export const InitUploadSchema = z.object({
  filename: z.string().min(1).max(260),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.coerce.number().int().positive().max(50 * 1024 * 1024), // 50 MB
  category: DocumentCategorySchema,
  employeeId: z.string().cuid().optional(),
  retentionUntil: z.string().date().optional(),
});

export const FinalizeUploadSchema = z.object({
  documentId: z.string().cuid(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
