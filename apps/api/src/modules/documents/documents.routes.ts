import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePerm } from '@/middleware/auth.js';
import { setOrgContext } from '@/middleware/orgContext.js';
import {
  FinalizeUploadSchema,
  InitUploadSchema,
} from '@/modules/documents/documents.schemas.js';
import {
  finalizeUpload,
  getDownloadUrl,
  initUpload,
  listDocuments,
} from '@/modules/documents/documents.service.js';

export const documentsRouter: Router = Router();
documentsRouter.use(requireAuth, setOrgContext);

documentsRouter.post(
  '/init',
  requirePerm('document.upload'),
  async (req: Request, res: Response) => {
    const input = InitUploadSchema.parse(req.body);
    const result = await initUpload({
      orgId: req.user!.org,
      uploaderUserId: req.user!.sub,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      category: input.category,
      ...(input.employeeId ? { employeeId: input.employeeId } : {}),
      ...(input.retentionUntil ? { retentionUntil: input.retentionUntil } : {}),
    });
    res.status(201).json(result);
  },
);

documentsRouter.post(
  '/finalize',
  requirePerm('document.upload'),
  async (req: Request, res: Response) => {
    const input = FinalizeUploadSchema.parse(req.body);
    const document = await finalizeUpload({
      orgId: req.user!.org,
      documentId: input.documentId,
      sha256: input.sha256,
      actor: {
        userId: req.user!.sub,
        ip: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
        requestId: req.id,
      },
    });
    res.json({ document });
  },
);

documentsRouter.get(
  '/:id/download',
  requirePerm('document.read.self'),
  async (req: Request, res: Response) => {
    const id = z.string().min(1).parse(req.params.id);
    const result = await getDownloadUrl(req.user!.org, id);
    res.json(result);
  },
);

const ListQuery = z.object({
  employeeId: z.string().cuid().optional(),
  category: z
    .enum(['id_document', 'contract', 'payslip', 'tax_form', 'certificate', 'policy', 'other'])
    .optional(),
});

documentsRouter.get(
  '/',
  requirePerm('document.read.self'),
  async (req: Request, res: Response) => {
    const q = ListQuery.parse(req.query);
    const documents = await listDocuments(req.user!.org, q);
    res.json({ documents });
  },
);
