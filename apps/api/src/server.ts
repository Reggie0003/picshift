/**
 * Server entrypoint. Boots the Express app and wires up graceful shutdown
 * so in-flight requests complete cleanly when the orchestrator sends SIGTERM.
 */
import { createServer } from 'node:http';
import { buildApp } from '@/app.js';
import { env } from '@/config/env.js';
import { logger } from '@/lib/logger.js';
import { closePrisma, getPrisma } from '@/lib/prisma.js';
import { closeRedis, getRedis } from '@/lib/redis.js';

async function main(): Promise<void> {
  // Eagerly initialise so any connection errors surface during boot.
  getPrisma();
  getRedis();

  const app = buildApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, publicUrl: env.API_PUBLIC_URL },
      'picshift-api listening',
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown signal received');

    server.close((err) => {
      if (err) logger.error({ err: err.message }, 'http server close error');
    });

    // 25 s budget so K8s/Docker default 30 s SIGKILL doesn't catch us.
    const timeout = setTimeout(() => {
      logger.warn('shutdown timeout — forcing exit');
      process.exit(1);
    }, 25_000);
    timeout.unref();

    try {
      await closePrisma();
      await closeRedis();
      logger.info('clean shutdown');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown error');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    void shutdown('uncaughtException');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal boot error');
  process.exit(1);
});
