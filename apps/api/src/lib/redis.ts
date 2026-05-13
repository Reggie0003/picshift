/**
 * Redis client used for:
 *   - Distributed rate limiting (rate-limit-redis)
 *   - Login attempt counters / account lockout
 *   - Session blacklist (revoked refresh tokens)
 *   - MFA challenge cache
 *   - Future: Bull queue for payroll jobs
 */
import Redis, { type Redis as RedisClient } from 'ioredis';
import { env } from '@/config/env.js';
import { logger } from '@/lib/logger.js';

let client: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT'];
      return targetErrors.some((m) => err.message.includes(m));
    },
  });
  client.on('error', (err) => {
    logger.error({ err: err.message }, 'redis error');
  });
  client.on('connect', () => {
    logger.info('redis connected');
  });
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
