/**
 * Password hashing using Argon2id with conservative parameters.
 *
 * memoryCost: 64 MB — strong against GPU/ASIC attacks, fits easily on a
 *                     1 GB API container.
 * timeCost  : 3      — ~300 ms on a modern CPU.
 * parallelism: 1     — single-threaded for predictable latency under load.
 *
 * These parameters are above OWASP 2025 minimums. Increase memory if your
 * VMware host has plenty of RAM.
 */
import argon2 from 'argon2';
import { z } from 'zod';

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Password strength requirements.
 *   - 12+ chars  (NIST SP 800-63B endorses long over complex)
 *   - At least one lowercase, uppercase, digit, symbol
 *   - Not in the common-password blocklist (extend with HIBP API if desired)
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'qwerty123',
  'iloveyou',
  'admin1234',
  'welcome1',
  'changeme',
  'picshift1',
]);

export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((p) => /[a-z]/.test(p), 'Must contain a lowercase letter')
  .refine((p) => /[A-Z]/.test(p), 'Must contain an uppercase letter')
  .refine((p) => /[0-9]/.test(p), 'Must contain a digit')
  .refine((p) => /[^A-Za-z0-9]/.test(p), 'Must contain a symbol')
  .refine(
    (p) => !COMMON_PASSWORDS.has(p.toLowerCase()),
    'This password is too common — pick something stronger',
  );
