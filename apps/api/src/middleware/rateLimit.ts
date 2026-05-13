/**
 * Distributed rate limiting backed by Redis. We expose two limiters:
 *
 *   globalLimiter  — applied to every request (default: 120 req/min/IP)
 *   authLimiter    — applied to /auth/* (default: 10 req/min/IP)
 *
 * In production behind Cloudflare or any reverse proxy, ensure
 * `app.set('trust proxy', 1)` so the limiter sees the real client IP.
 */
import rateLimit, { type Options } from 'express-rate-limit';
import RedisStore, { type RedisReply } from 'rate-limit-redis';
import { getRedis } from '@/lib/redis.js';
import { env } from '@/config/env.js';

function makeStore(prefix: string): RedisStore {
  const client = getRedis();
  return new RedisStore({
    sendCommand: (...args: string[]): Promise<RedisReply> =>
      client.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
    prefix: `rl:${prefix}:`,
  });
}

const baseConfig: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' },
  },
};

export const globalLimiter = rateLimit({
  ...baseConfig,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  store: makeStore('g'),
});

export const authLimiter = rateLimit({
  ...baseConfig,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  store: makeStore('a'),
  // Skip successful responses so legitimate users aren't penalised.
  skipSuccessfulRequests: true,
});
