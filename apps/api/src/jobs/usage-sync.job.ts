import { getRedisConnection } from '../config/redis.js';
import { resetMonthlyUsage, syncUsageToMongo } from '../services/usage.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('usage-sync');

const USAGE_SYNC_INTERVAL_MS = 60_000;

let syncTimer: NodeJS.Timeout | null = null;
let monthlyResetTimer: NodeJS.Timeout | null = null;
let isSyncRunning = false;
let isResetRunning = false;

function currentUtcMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function millisecondsUntilNextUtcMonth(date = new Date()): number {
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return Math.max(1, nextMonth.getTime() - date.getTime());
}

async function runUsageSync(): Promise<void> {
  if (isSyncRunning) {
    return;
  }
  isSyncRunning = true;
  try {
    await syncUsageToMongo();
  } catch (error) {
    logger.error({ err: error }, 'Periodic usage sync failed');
  } finally {
    isSyncRunning = false;
  }
}

async function runMonthlyReset(): Promise<void> {
  if (isResetRunning) {
    return;
  }
  isResetRunning = true;
  const now = new Date();
  try {
    await resetMonthlyUsage();
    logger.info({ month: currentUtcMonthKey(now) }, 'Monthly usage reset completed');
  } catch (error) {
    logger.error({ err: error, month: currentUtcMonthKey(now) }, 'Monthly usage reset failed');
  } finally {
    isResetRunning = false;
  }
}

function scheduleMonthlyReset(): void {
  monthlyResetTimer = setTimeout(() => {
    void runMonthlyReset().finally(scheduleMonthlyReset);
  }, millisecondsUntilNextUtcMonth());
  monthlyResetTimer.unref();
}

export function startUsageSyncJob(): void {
  if (syncTimer || monthlyResetTimer) {
    return;
  }

  void getRedisConnection()
    .ping()
    .then(() => runUsageSync())
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Usage sync job could not reach Redis');
    });
  syncTimer = setInterval(() => void runUsageSync(), USAGE_SYNC_INTERVAL_MS);
  syncTimer.unref();
  scheduleMonthlyReset();
}

export async function stopUsageSyncJob(): Promise<void> {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (monthlyResetTimer) {
    clearInterval(monthlyResetTimer);
    monthlyResetTimer = null;
  }
  await runUsageSync();
}
