import { getRedisConnection } from '../config/redis.js';
import { resetMonthlyUsage, syncUsageToMongo } from '../services/usage.service.js';

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
    console.error('[hookrelay-api] periodic usage sync failed:', error);
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
    console.info(`[hookrelay-api] monthly usage reset completed for ${currentUtcMonthKey(now)}`);
  } catch (error) {
    console.error('[hookrelay-api] monthly usage reset failed:', error);
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
      console.error('[hookrelay-api] usage sync job could not reach Redis:', error);
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
