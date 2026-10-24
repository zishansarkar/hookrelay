import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Developer } from '../../src/models/index.js';

const { redisState, mockRedis } = vi.hoisted(() => {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const redis = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...args: string[]) => {
      if (args.includes('NX') && values.has(key)) {
        return null;
      }
      values.set(key, value);
      return 'OK';
    }),
    sadd: vi.fn(async (key: string, member: string) => {
      const members = sets.get(key) ?? new Set<string>();
      members.add(member);
      sets.set(key, members);
      return 1;
    }),
    smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),
    incr: vi.fn(async (key: string) => {
      const value = Number(values.get(key) ?? '0') + 1;
      values.set(key, String(value));
      return value;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (...keys: string[]) => {
      keys.forEach((key) => values.delete(key));
      return keys.length;
    }),
    eval: vi.fn(async (_script: string, _keyCount: number, usageKey: string) => {
      const value = Number(values.get(usageKey) ?? '0') + 1;
      values.set(usageKey, String(value));
      return [value, value];
    }),
  };
  return { redisState: { values, sets }, mockRedis: redis };
});

vi.mock('../../src/config/redis.js', () => ({
  getRedisConnection: () => mockRedis,
}));

import {
  getUsage,
  isWithinLimit,
  resetMonthlyUsage,
  trackUsage,
} from '../../src/services/usage.service.js';

const DEVELOPER_ID = 'usage-service-test';

describe('usage service', () => {
  beforeEach(async () => {
    redisState.values.clear();
    redisState.sets.clear();
    vi.clearAllMocks();
    await Developer.create({
      id: DEVELOPER_ID,
      email: 'usage-test@example.com',
      passwordHash: 'test-hash',
      plan: 'free',
      webhooksUsedThisMonth: 4,
    });
  });

  it('atomically tracks usage in Redis and returns the new count', async () => {
    await expect(trackUsage(DEVELOPER_ID)).resolves.toBe(1);

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    expect(mockRedis.sadd).not.toHaveBeenCalled();
  });

  it('returns live usage, plan allowance, and next UTC month reset date', async () => {
    const date = new Date();
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    redisState.values.set(`hookrelay:usage:${month}:${DEVELOPER_ID}`, '7');

    const usage = await getUsage(DEVELOPER_ID);

    expect(usage).toMatchObject({ used: 7, limit: 10_000, plan: 'free' });
    expect(usage.resetDate).toEqual(
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
    );
  });

  it('checks whether usage remains within the developer plan limit', async () => {
    await expect(isWithinLimit(DEVELOPER_ID)).resolves.toBe(true);

    const date = new Date();
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    redisState.values.set(`hookrelay:usage:${month}:${DEVELOPER_ID}`, '10000');
    await expect(isWithinLimit(DEVELOPER_ID)).resolves.toBe(false);
  });

  it('resets MongoDB usage and deletes the prior-month Redis counters', async () => {
    await mockRedis.sadd('hookrelay:usage:active-developers', DEVELOPER_ID);

    await resetMonthlyUsage();

    const developer = await Developer.findOne({ id: DEVELOPER_ID });
    expect(developer?.webhooksUsedThisMonth).toBe(0);
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^hookrelay:usage:\d{4}-\d{2}:usage-service-test$/),
      expect.stringMatching(/^hookrelay:usage:sync-count:\d{4}-\d{2}:usage-service-test$/),
    );
  });
});
