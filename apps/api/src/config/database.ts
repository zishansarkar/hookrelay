import mongoose from 'mongoose';
import { loadConfig } from './environment.js';

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
    mongoose.set('debug', true);
  }

  mongoose.connection.on('error', (error: unknown) => {
    console.error('[hookrelay-api] MongoDB connection error:', describeError(error));
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(config.databaseUrl, {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      });
      console.info(`[hookrelay-api] MongoDB connected (attempt ${attempt})`);
      return mongoose;
    } catch (error) {
      lastError = error;
      console.error(
        `[hookrelay-api] MongoDB connection attempt ${attempt}/${MAX_CONNECTION_ATTEMPTS} failed: ${describeError(error)}`,
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
