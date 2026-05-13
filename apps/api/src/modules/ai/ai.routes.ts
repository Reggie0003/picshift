import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth.js';
import { setOrgContext } from '@/middleware/orgContext.js';
import { askAssistant } from '@/modules/ai/assistant.service.js';

export const aiRouter: Router = Router();
aiRouter.use(requireAuth, setOrgContext);

const AskSchema = z.object({
  question: z.string().min(2).max(2000).trim(),
});

aiRouter.post('/ask', async (req: Request, res: Response) => {
  const { question } = AskSchema.parse(req.body);
  const result = await askAssistant({
    orgId: req.user!.org,
    userId: req.user!.sub,
    question,
    ip: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    requestId: req.id,
  });
  res.json(result);
});
