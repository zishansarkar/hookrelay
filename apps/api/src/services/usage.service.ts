import { PLAN_LIMITS, type Plan } from '@hookrelay/shared';
import { getRedisConnection } from '../config/redis.js';
import { Developer, WebhookEvent } from '../models/index.js';

const USAGE_KEY_PREFIX = 'hookrelay:usage';
const ACTIVE_DEVELOPERS_KEY = `${USAGE_KEY_PREFIX}:active-developers`;
const SYNC_COUNTER_PREFIX = `${USAGE_KEY_PREFIX}:sync-count`;
const SYNC_BATCH_SIZE = 100;
const REDIS_COUNTER_TTL_SECONDS = 45 * 24 * 60 * 60;
const TRACK_USAGE_SCRIPT = `
local usage = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[2])
local syncCount = redis.call('INCR', KEYS[3])
if syncCount == 1 then
  redis.call('EXPIRE', KEYS[3], ARGV[1])
end
return { usage, syncCount }
`;

export interface UsageStats {
  used: number;
  limit: number;
  plan: Plan;
  resetDate: Date;
}

export interface DailyUsageStat {
  date: string;
  count: number;
}

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function redisUsageKey(developerId: string, month = monthKey()): string {
  return `${USAGE_KEY_PREFIX}:${month}:${developerId}`;
}

function resetDate(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

async function readUsageCount(developerId: string, fallback: number): Promise<number> {
  const redis = getRedisConnection();
  const key = redisUsageKey(developerId);
  const existing = await redis.get(key);
  if (existing !== null) {
    const count = Number(existing);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid Redis usage count for developer ${developerId}`);
    }
    return count;
  }

  await redis.set(key, String(fallback), 'EX', REDIS_COUNTER_TTL_SECONDS, 'NX');
  await redis.sadd(ACTIVE_DEVELOPERS_KEY, developerId);
  const initialized = await redis.get(key);
  if (initialized === null) {
    throw new Error(`Failed to initialize usage counter for developer ${developerId}`);
  }
  return Number(initialized);
}

async function syncDeveloperUsage(developerId: string): Promise<void> {
  const redis = getRedisConnection();
  const value = await redis.get(redisUsageKey(developerId));
  if (value === null) {
    return;
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid Redis usage count for developer ${developerId}`);
  }

  await Developer.updateOne({ id: developerId }, { $set: { webhooksUsedThisMonth: count } });
  await redis.del(`${SYNC_COUNTER_PREFIX}:${monthKey()}:${developerId}`);
}

/**
 * Atomically increments this month's Redis counter. MongoDB is synchronized
 * every 100 increments for this developer; the periodic usage job also flushes
 * all active developers at least once per minute.
 */
export async function trackUsage(developerId: string): Promise<number> {
  const redis = getRedisConnection();
  const month = monthKey();
  const result = await redis.eval(
    TRACK_USAGE_SCRIPT,
    3,
    redisUsageKey(developerId, month),
    ACTIVE_DEVELOPERS_KEY,
    `${SYNC_COUNTER_PREFIX}:${month}:${developerId}`,
    REDIS_COUNTER_TTL_SECONDS,
    developerId,
  );
  if (!Array.isArray(result) || typeof result[0] !== 'number' || typeof result[1] !== 'number') {
    throw new Error(`Redis returned an invalid usage tracking result for ${developerId}`);
  }
  const [value, syncCount] = result;
  if (syncCount >= SYNC_BATCH_SIZE) {
    await syncDeveloperUsage(developerId);
  }
  return value;
}

export async function getUsage(developerId: string): Promise<UsageStats> {
  const developer = await Developer.findOne({ id: developerId });
  if (!developer) {
    throw new Error(`Developer ${developerId} was not found`);
  }

  const used = await readUsageCount(developerId, developer.webhooksUsedThisMonth);
  return {
    used,
    limit: PLAN_LIMITS[developer.plan].monthlyWebhooks,
    plan: developer.plan,
    resetDate: resetDate(),
  };
}

export async function getDailyUsage(developerId: string): Promise<DailyUsageStat[]> {
  const today = new Date();
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const startDate = new Date(todayStart);
  startDate.setUTCDate(startDate.getUTCDate() - 29);
  const endDate = new Date(todayStart);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  const counts = await WebhookEvent.aggregate<{ _id: string; count: number }>([
    { $match: { developerId, createdAt: { $gte: startDate, $lt: endDate } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'UTC',
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const countByDate = new Map(counts.map(({ _id, count }) => [_id, count]));

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    return { date: dateKey, count: countByDate.get(dateKey) ?? 0 };
  });
}

export async function isWithinLimit(developerId: string): Promise<boolean> {
  const developer = await Developer.findOne({ id: developerId });
  if (!developer) {
    return false;
  }

  const used = await readUsageCount(developerId, developer.webhooksUsedThisMonth);
  return used < PLAN_LIMITS[developer.plan].monthlyWebhooks;
}

/**
 * Flushes every known Redis counter to MongoDB. Intended for the periodic job.
 */
export async function syncUsageToMongo(): Promise<void> {
  const redis = getRedisConnection();
  const developerIds = await redis.smembers(ACTIVE_DEVELOPERS_KEY);
  const results = await Promise.allSettled(developerIds.map(syncDeveloperUsage));
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `Failed to sync usage for ${failures.length} developer(s)`,
    );
  }
}

/**
 * Resets all monthly usage at the UTC month boundary.
 */
export async function resetMonthlyUsage(): Promise<void> {
  await Developer.updateMany({}, { $set: { webhooksUsedThisMonth: 0 } });

  const redis = getRedisConnection();
  const activeIds = await redis.smembers(ACTIVE_DEVELOPERS_KEY);
  const priorMonth = monthKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const keys = activeIds.flatMap((developerId) => [
    redisUsageKey(developerId, priorMonth),
    `${SYNC_COUNTER_PREFIX}:${priorMonth}:${developerId}`,
  ]);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
