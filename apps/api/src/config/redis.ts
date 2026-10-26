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
 */
export function createRedisConnection(connectionName = 'hookrelay-api'): Redis {
  const { redisUrl } = loadConfig();
  const usesTls = redisUrl.startsWith('rediss://');

  let servername: string | undefined;
  try {
    servername = new URL(redisUrl).hostname;
  } catch {
    // fallback if URL parsing fails
  }

  const options: RedisOptions = {
    connectionName,
    maxRetriesPerRequest: null,
    family: 4, // IPv4
    ...(usesTls
      ? {
          tls: {
            rejectUnauthorized: false, // 👈 Render & Upstash TLS হ্যান্ডশেক ফিক্স
            servername,
          },
        }
      : {}),
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

export function getRedisConnection(): Redis {
  sharedConnection ??= createRedisConnection();
  return sharedConnection;
}

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