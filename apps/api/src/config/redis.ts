import { Redis, type RedisOptions } from 'ioredis';
import { loadConfig } from './environment.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('redis');

/** How long startup waits for Redis before declaring it unreachable. */
const VERIFY_TIMEOUT_MS = 10_000;

/** How long a graceful shutdown waits for pending Redis commands. */
const QUIT_TIMEOUT_MS = 5_000;

/** Hides credentials before a URL is written to the logs. */
function describeUrl(redisUrl: string): string {
  try {
    const parsed = new URL(redisUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '<invalid REDIS_URL>';
  }
}

/**
 * Creates a Redis connection from `REDIS_URL`.
 *
 * TLS is enabled automatically for `rediss://` URLs, which is what production
 * deployments use; plain `redis://` stays unencrypted for local development.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ: commands must not be
 * rejected while the connection is re-establishing.
 */
export function createRedisConnection(connectionName = 'hookrelay-api'): Redis {
  const { redisUrl } = loadConfig();
  const usesTls = redisUrl.startsWith('rediss://');

  const options: RedisOptions = {
    connectionName,
    maxRetriesPerRequest: null,
    ...(usesTls ? { tls: {} } : {}),
  };

  const connection = new Redis(redisUrl, options);

  connection.on('connect', () => {
    logger.info({ redisUrl: describeUrl(redisUrl) }, 'Connecting to Redis');
  });
  connection.on('ready', () => {
    logger.info({ tls: usesTls }, 'Redis ready');
  });
  connection.on('error', (error: Error) => {
    logger.error({ err: error }, 'Redis connection error');
  });
  connection.on('close', () => {
    logger.info('Redis connection closed');
  });

  return connection;
}

let sharedConnection: Redis | null = null;

/**
 * Returns the process-wide Redis connection, creating it on first use.
 *
 * Queues share this connection; it is also the one closed on shutdown.
 */
export function getRedisConnection(): Redis {
  sharedConnection ??= createRedisConnection();
  return sharedConnection;
}

/**
 * Verifies that Redis is reachable, failing fast at startup otherwise.
 *
 * The connection retries indefinitely, so a timeout is needed to turn an
 * unreachable server into a readable startup error instead of a hang.
 */
export async function verifyRedisConnection(timeoutMs = VERIFY_TIMEOUT_MS): Promise<void> {
  const { redisUrl } = loadConfig();
  const connection = getRedisConnection();

  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      connection.ping(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`no reply within ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to connect to Redis at ${describeUrl(redisUrl)}: ${reason}`);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Closes the shared connection, waiting for pending commands first.
 *
 * Falls back to an immediate disconnect if `quit()` does not settle in time,
 * so shutdown can never hang on Redis.
 */
export async function closeRedisConnection(): Promise<void> {
  const connection = sharedConnection;
  if (!connection) {
    return;
  }
  sharedConnection = null;

  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      connection.quit(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('quit timed out'));
        }, QUIT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    logger.error({ err: error }, 'Failed to gracefully close Redis; disconnecting immediately');
    connection.disconnect();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
