import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryStatus } from '@hookrelay/shared';
import { Developer, WebhookEvent } from '../../src/models/index.js';

vi.mock('../../src/queues/webhook.queue.js', () => ({
  addWebhookJob: vi.fn().mockResolvedValue({}),
}));
const { usageMocks } = vi.hoisted(() => ({
  usageMocks: {
    isWithinLimit: vi.fn(),
    trackUsage: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock('../../src/services/usage.service.js', () => usageMocks);

import { addWebhookJob } from '../../src/queues/webhook.queue.js';
import { trackUsage } from '../../src/services/usage.service.js';
import { send } from '../../src/services/webhook.service.js';

const TEST_DEVELOPER_ID = 'developer-service-test';
const webhookRequest = {
  targetUrl: 'https://receiver.example/webhooks',
  payload: { type: 'payment.succeeded', amount: 1200 },
};

describe('webhook service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    usageMocks.isWithinLimit.mockResolvedValue(true);
    usageMocks.trackUsage.mockResolvedValue(1);
    await Developer.create({
      id: TEST_DEVELOPER_ID,
      email: 'service-test@example.com',
      passwordHash: 'test-hash',
      plan: 'free',
    });
  });

  it('creates a queued webhook event and enqueues its first delivery attempt', async () => {
    const result = await send(TEST_DEVELOPER_ID, webhookRequest);
    const event = await WebhookEvent.findOne({ id: result.eventId });

    expect(event).not.toBeNull();
    expect(event?.status).toBe(DeliveryStatus.QUEUED);
    expect(event?.payload).toEqual(webhookRequest.payload);
    expect(addWebhookJob).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: result.eventId,
        developerId: TEST_DEVELOPER_ID,
        attemptNumber: 0,
      }),
    );
  });

  it('increments the developer webhook usage counter after accepting an event', async () => {
    await send(TEST_DEVELOPER_ID, webhookRequest);

    expect(trackUsage).toHaveBeenCalledWith(TEST_DEVELOPER_ID);
  });

  it('rejects the event when the developer has reached the plan limit', async () => {
    usageMocks.isWithinLimit.mockResolvedValueOnce(false);

    await expect(send(TEST_DEVELOPER_ID, webhookRequest)).rejects.toMatchObject({
      status: 429,
      code: 'QUOTA_EXCEEDED',
    });
    expect(addWebhookJob).not.toHaveBeenCalled();
    expect(await WebhookEvent.countDocuments({ developerId: TEST_DEVELOPER_ID })).toBe(0);
  });
});
