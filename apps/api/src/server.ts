import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/environment.js';
import { closeRedisConnection, verifyRedisConnection } from './config/redis.js';
import { startWorkers, type HookRelayWorkers } from './workers/index.js';
import { startUsageSyncJob, stopUsageSyncJob } from './jobs/usage-sync.job.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('server');

/** How long a graceful shutdown may take before connections are force-closed. */
const SHUTDOWN_TIMEOUT_MS = 40_000;

/**
 * Stops accepting new connections, drains the in-flight ones and closes the
 * database and Redis connections.
 */
function registerShutdownHandlers(server: Server, workers: HookRelayWorkers): void {
  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, 'Shutting down gracefully');

    const forceExit = setTimeout(() => {
      logger.fatal({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Graceful shutdown timed out');
      server.closeAllConnections();
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close((closeError) => {
      if (closeError) {
        logger.error({ err: closeError }, 'Failed to close the HTTP server');
      }

      void (async () => {
        try {
          await workers.close();
        } catch (workerError: unknown) {
          logger.error({ err: workerError }, 'Failed to close workers');
        }

        try {
          await stopUsageSyncJob();
        } catch (usageError: unknown) {
          logger.error({ err: usageError }, 'Failed to stop usage sync job');
        }

        await Promise.allSettled([
          disconnectDatabase().catch((databaseError: unknown) => {
            logger.error({ err: databaseError }, 'Failed to close MongoDB connection');
          }),
          closeRedisConnection().catch((redisError: unknown) => {
            logger.error({ err: redisError }, 'Failed to close Redis connection');
          }),
        ]);
        clearTimeout(forceExit);
        process.exit(closeError ? 1 : 0);
      })();
    });

    server.closeIdleConnections();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection; initiating shutdown');
    shutdown('SIGTERM');
  });
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, 'Uncaught exception; initiating shutdown');
    shutdown('SIGTERM');
  });
}

async function main(): Promise<void> {
  const config = loadConfig();

  await connectDatabase();
  await verifyRedisConnection();

  const workers = startWorkers();
  startUsageSyncJob();
  const app = createApp(config);
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, nodeVersion: process.version, environment: config.nodeEnv },
      'HTTP server listening',
    );
  });

  registerShutdownHandlers(server, workers);
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start API server');
  process.exitCode = 1;
});
