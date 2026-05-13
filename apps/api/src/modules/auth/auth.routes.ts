import { Router, type Request, type Response } from 'express';
import {
  LoginSchema,
  MfaEnrollVerifySchema,
  MfaVerifySchema,
  RefreshSchema,
  SignupSchema,
} from '@/modules/auth/auth.schemas.js';
import {
  confirmMfaEnrollment,
  login,
  logout,
  refreshTokens,
  signup,
  startMfaEnrollment,
  verifyMfaChallenge,
} from '@/modules/auth/auth.service.js';
import { authLimiter } from '@/middleware/rateLimit.js';
import { requireAuth } from '@/middleware/auth.js';
import type { AuthContext } from '@/modules/auth/auth.service.js';

export const authRouter: Router = Router();

function ctxOf(req: Request): AuthContext {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    requestId: req.id,
  };
}

authRouter.post('/signup', authLimiter, async (req: Request, res: Response) => {
  const input = SignupSchema.parse(req.body);
  const result = await signup(input, ctxOf(req));
  res.status(201).json(result);
});

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  const input = LoginSchema.parse(req.body);
  const result = await login(input.email, input.password, ctxOf(req));
  res.json(result);
});

authRouter.post('/mfa/verify', authLimiter, async (req: Request, res: Response) => {
  const { challengeId, totp } = MfaVerifySchema.parse(req.body);
  const tokens = await verifyMfaChallenge(challengeId, totp, ctxOf(req));
  res.json({ status: 'authenticated', tokens });
});

authRouter.post('/mfa/enroll', requireAuth, async (req: Request, res: Response) => {
  const result = await startMfaEnrollment(req.user!.sub);
  // Don't return the raw secret to the client; the QR + URI are enough.
  res.json({
    otpauthUri: result.otpauthUri,
    qrPngDataUrl: result.qrPngDataUrl,
  });
});

authRouter.post('/mfa/enroll/verify', requireAuth, async (req: Request, res: Response) => {
  const { totp } = MfaEnrollVerifySchema.parse(req.body);
  await confirmMfaEnrollment(req.user!.sub, totp, ctxOf(req));
  res.json({ ok: true });
});

authRouter.post('/refresh', authLimiter, async (req: Request, res: Response) => {
  const { refreshToken } = RefreshSchema.parse(req.body);
  const tokens = await refreshTokens(refreshToken, ctxOf(req));
  res.json({ tokens });
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = RefreshSchema.parse(req.body);
  await logout(refreshToken, ctxOf(req));
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user!.sub,
      org: req.user!.org,
      roles: req.user!.roles,
      mfa: req.user!.mfa,
    },
  });
});
