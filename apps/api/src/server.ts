import type { Server } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/environment.js';

/** How long a graceful shutdown may take before connections are force-closed. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Stops accepting new connections, drains the in-flight ones and closes the
 * MongoDB connection.
 */
function registerShutdownHandlers(server: Server): void {
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

      void disconnectDatabase()
        .catch((databaseError: unknown) => {
          console.error('[hookrelay-api] failed to close the MongoDB connection:', databaseError);
        })
        .finally(() => {
          clearTimeout(forceExit);
          process.exit(closeError ? 1 : 0);
        });
    });

    server.closeIdleConnections();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

async function main(): Promise<void> {
  const config = loadConfig();

  await connectDatabase();

  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.info(
      `[hookrelay-api] listening on http://localhost:${config.port} ` +
        `(environment: ${config.nodeEnv}, node: ${process.version})`,
    );
  });

  registerShutdownHandlers(server);
}

main().catch((error: unknown) => {
  console.error('[hookrelay-api] failed to start:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
