import mongoose from 'mongoose';
import { loadConfig } from './environment.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('database');

/** Number of connection attempts before giving up. */
export const MAX_CONNECTION_ATTEMPTS = 3;

/** Delay between connection attempts. */
export const RETRY_DELAY_MS = 5_000;

/** How long to wait for a reachable server before failing an attempt. */
const SERVER_SELECTION_TIMEOUT_MS = 5_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Connects Mongoose to MongoDB, retrying transient failures.
 *
 * @throws when the database is still unreachable after all attempts.
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  const config = loadConfig();

  mongoose.set('strict', true);
  if (config.nodeEnv === 'development') {
    mongoose.set('debug', (collectionName, methodName) => {
      logger.debug({ collectionName, methodName }, 'MongoDB query');
    });
  }

  mongoose.connection.on('error', (error: unknown) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(config.databaseUrl, {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      });
      logger.info({ attempt }, 'MongoDB connected');
      return mongoose;
    } catch (error) {
      lastError = error;
      logger.error(
        { err: error, attempt, maxAttempts: MAX_CONNECTION_ATTEMPTS },
        'MongoDB connection attempt failed',
      );
      if (attempt < MAX_CONNECTION_ATTEMPTS) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Failed to connect to MongoDB after ${MAX_CONNECTION_ATTEMPTS} attempts: ${describeError(lastError)}`,
  );
}

/**
 * Closes the MongoDB connection.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
