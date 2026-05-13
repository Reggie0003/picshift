/**
 * Structured logging via Pino. Every log line is JSON in production
 * (consumable by Datadog/Loki/CloudWatch) and pretty in development.
 *
 * PII redaction: never log password, token, ssnit_number, ghana_card_number,
 * tin, bvn, nin, momo_number, bank_account_number, or document_url.
 */
import pino from 'pino';
import { env, isProd } from '@/config/env.js';

const REDACT_PATHS = [
  'password',
  '*.password',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.ssnit_number',
  '*.ghana_card_number',
  '*.tin',
  '*.bvn',
  '*.nin',
  '*.momo_number',
  '*.bank_account_number',
  '*.encryption_key',
  '*.refresh_token',
  '*.access_token',
  '*.totp_secret',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'picshift-api', env: env.NODE_ENV },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
});

export type Logger = typeof logger;
