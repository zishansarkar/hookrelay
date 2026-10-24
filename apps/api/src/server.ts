import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/environment.js';
import { closeRedisConnection, verifyRedisConnection } from './config/redis.js';
import { startWorkers, type HookRelayWorkers } from './workers/index.js';
import { startUsageSyncJob, stopUsageSyncJob } from './jobs/usage-sync.job.js';

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

    console.info(`[hookrelay-api] ${signal} received — shutting down gracefully`);

    const forceExit = setTimeout(() => {
      console.error('[hookrelay-api] graceful shutdown timed out — forcing exit');
      server.closeAllConnections();
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close((closeError) => {
      if (closeError) {
        console.error('[hookrelay-api] failed to close the HTTP server:', closeError);
      }

      void (async () => {
        try {
          await workers.close();
        } catch (workerError: unknown) {
          console.error('[hookrelay-api] failed to close workers:', workerError);
        }

        try {
          await stopUsageSyncJob();
        } catch (usageError: unknown) {
          console.error('[hookrelay-api] failed to stop the usage sync job:', usageError);
        }

        await Promise.allSettled([
          disconnectDatabase().catch((databaseError: unknown) => {
            console.error('[hookrelay-api] failed to close the MongoDB connection:', databaseError);
          }),
          closeRedisConnection().catch((redisError: unknown) => {
            console.error('[hookrelay-api] failed to close the Redis connection:', redisError);
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
}

async function main(): Promise<void> {
  const config = loadConfig();

  await connectDatabase();
  await verifyRedisConnection();

  const workers = startWorkers();
  startUsageSyncJob();
  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.info(
      `[hookrelay-api] listening on http://localhost:${config.port} ` +
        `(environment: ${config.nodeEnv}, node: ${process.version})`,
    );
  });

  registerShutdownHandlers(server, workers);
}

main().catch((error: unknown) => {
  console.error('[hookrelay-api] failed to start:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
