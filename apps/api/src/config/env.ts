/**
 * Environment configuration with strict Zod validation.
 *
 * The server refuses to boot if any required variable is missing or malformed.
 * This prevents the classic class of "production booted with default secrets"
 * outages that compromise payroll systems.
 */
import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be 32 bytes (44 base64 chars)'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET_DOCUMENTS: z.string().min(1),
  S3_BUCKET_BACKUPS: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  EMAIL_PROVIDER: z.enum(['ses', 'sendgrid', 'smtp', 'console']).default('console'),
  EMAIL_FROM: z.string().min(1).default('Pic Shift <no-reply@picshift.app>'),
  SES_REGION: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),

  SMS_PROVIDER: z.enum(['hubtel', 'twilio', 'console']).default('console'),
  HUBTEL_CLIENT_ID: z.string().optional(),
  HUBTEL_CLIENT_SECRET: z.string().optional(),
  HUBTEL_SENDER_ID: z.string().default('PicShift'),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),

  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),

  MTN_MOMO_API_USER: z.string().optional(),
  MTN_MOMO_API_KEY: z.string().optional(),
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().optional(),
  MTN_MOMO_TARGET_ENV: z.enum(['sandbox', 'production']).default('sandbox'),

  VODAFONE_CASH_MERCHANT_ID: z.string().optional(),
  VODAFONE_CASH_API_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  DEFAULT_TIMEZONE: z.string().default('Africa/Accra'),
  DEFAULT_CURRENCY: z.enum(['GHS', 'NGN', 'USD', 'EUR', 'GBP']).default('GHS'),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n[env] Invalid configuration:\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = parseEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
