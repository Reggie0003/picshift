/**
 * Singleton Prisma client. The `set-org-context` middleware sets a
 * Postgres session variable (app.current_org_id) that RLS policies
 * use as a defence-in-depth check on top of application-layer filters.
 */
import { PrismaClient } from '@prisma/client';
import { env, isDev } from '@/config/env.js';
import { logger } from '@/lib/logger.js';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (prisma) return prisma;
  prisma = new PrismaClient({
    log: isDev
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
    datasources: { db: { url: env.DATABASE_URL } },
  });

  // Type-safe event subscription — Prisma's typings make these stringly-typed
  // so we cast to a minimal interface.
  const p = prisma as unknown as {
    $on: (e: 'warn' | 'error', cb: (ev: { message: string }) => void) => void;
  };
  p.$on('warn', (e) => logger.warn({ msg: e.message }, 'prisma warn'));
  p.$on('error', (e) => logger.error({ msg: e.message }, 'prisma error'));

  return prisma;
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
