import { z } from 'zod';
import { PasswordSchema } from '@/lib/passwords.js';

export const SignupSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: PasswordSchema,
  fullName: z.string().min(2).max(120).trim(),
  organizationName: z.string().min(2).max(160).trim(),
  country: z.enum(['GH', 'NG', 'KE', 'ZA', 'US', 'GB']).default('GH'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service' }),
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy' }),
  }),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const MfaVerifySchema = z.object({
  challengeId: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/, 'TOTP must be a 6-digit code'),
});

export const MfaEnrollVerifySchema = z.object({
  totp: z.string().regex(/^\d{6}$/, 'TOTP must be a 6-digit code'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});
