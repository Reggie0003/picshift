/**
 * Account lockout backed by Redis. Stops credential-stuffing and
 * online password-guessing attacks.
 *
 * Strategy:
 *   - Increment a per-(email|ip) counter on each failed login.
 *   - Lockout for LOGIN_LOCKOUT_SECONDS once the counter hits
 *     LOGIN_MAX_ATTEMPTS.
 *   - Successful login clears the counter.
 *
 * Why both email and IP keys: protects users from a per-email attack and
 * also slows distributed attacks from a single source IP.
 */
import { getRedis } from '@/lib/redis.js';
import { env } from '@/config/env.js';

const PREFIX = 'lockout:';

function emailKey(email: string): string {
  return `${PREFIX}email:${email.toLowerCase()}`;
}
function ipKey(ip: string): string {
  return `${PREFIX}ip:${ip}`;
}

export async function isLockedOut(email: string, ip: string): Promise<boolean> {
  const r = getRedis();
  const [emailLock, ipLock] = await Promise.all([r.get(emailKey(email)), r.get(ipKey(ip))]);
  return Number(emailLock ?? 0) >= env.LOGIN_MAX_ATTEMPTS ||
    Number(ipLock ?? 0) >= env.LOGIN_MAX_ATTEMPTS * 3;
}

export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const r = getRedis();
  const ttl = env.LOGIN_LOCKOUT_SECONDS;
  const ek = emailKey(email);
  const ik = ipKey(ip);
  const pipe = r.multi();
  pipe.incr(ek).expire(ek, ttl);
  pipe.incr(ik).expire(ik, ttl);
  await pipe.exec();
}

export async function clearLockout(email: string, ip: string): Promise<void> {
  const r = getRedis();
  await Promise.all([r.del(emailKey(email)), r.del(ipKey(ip))]);
}
