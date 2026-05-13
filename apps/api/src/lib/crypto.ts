/**
 * Field-level envelope encryption for PII at rest.
 *
 * Why: even with TLS in transit and disk encryption at rest, a Postgres
 * snapshot leak or an SQL-injection bypass would expose Ghana Card numbers,
 * SSNIT IDs, BVN, NIN, momo accounts, etc. We encrypt those columns BEFORE
 * they hit the DB so the DBA never sees the plaintext.
 *
 * Algorithm: AES-256-GCM. Key is the base64-decoded ENCRYPTION_KEY env var
 * (the KEK). In production, replace this in-process implementation with
 * AWS KMS GenerateDataKey for true envelope encryption with rotation.
 *
 * Format on disk: base64(iv || ciphertext || authTag).
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '@/config/env.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  // Accept either base64 (recommended) or raw 32-char string
  let key: Buffer;
  try {
    const decoded = Buffer.from(env.ENCRYPTION_KEY, 'base64');
    key = decoded.length === 32 ? decoded : Buffer.alloc(0);
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    // Fall back to deriving 32 bytes via SHA-256 if user provided a passphrase
    key = createHash('sha256').update(env.ENCRYPTION_KEY, 'utf8').digest();
  }
  cachedKey = key;
  return key;
}

export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptField(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) return null;
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Deterministic hash for searchable indexes on encrypted columns.
 * Use only when equality search is required (e.g. find employee by Ghana Card).
 * NOT a substitute for encryption — it's a one-way hash.
 */
export function hashSearchable(value: string): string {
  return createHash('sha256')
    .update(env.ENCRYPTION_KEY)
    .update('|')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

/** Last-4 helper used for "Account ending in •••• 1234" UX. */
export function maskLast4(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}
