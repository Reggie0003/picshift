/**
 * S3 client wrapper. Works with AWS S3 in production and MinIO locally
 * (set S3_ENDPOINT + S3_FORCE_PATH_STYLE=true for MinIO).
 *
 * We use presigned URLs so the API never has to proxy file bytes —
 * the browser uploads/downloads directly to/from S3. Sigv4 with a 5-minute
 * TTL keeps the surface area small.
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env.js';

let cached: S3Client | null = null;

export function getS3(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

export async function presignUpload(opts: {
  bucket: string;
  key: string;
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  expiresIn?: number; // seconds
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: opts.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
    ...(opts.contentLength !== undefined ? { ContentLength: opts.contentLength } : {}),
    ...(opts.metadata ? { Metadata: opts.metadata } : {}),
    // Server-side encryption with S3-managed keys (SSE-S3) at minimum.
    // Switch to aws:kms with a KMS key in production for SOC 2 evidence.
    ServerSideEncryption: 'AES256',
  });
  return getSignedUrl(getS3(), cmd, { expiresIn: opts.expiresIn ?? 300 });
}

export async function presignDownload(opts: {
  bucket: string;
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: opts.bucket, Key: opts.key });
  return getSignedUrl(getS3(), cmd, { expiresIn: opts.expiresIn ?? 120 });
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
