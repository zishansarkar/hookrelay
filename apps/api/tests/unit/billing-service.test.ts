import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStripeClient } = vi.hoisted(() => ({
  mockStripeClient: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn() },
  },
}));

vi.mock('../../src/config/stripe.js', () => ({
  stripe: mockStripeClient,
  PRICE_IDS: { pro: 'price_pro', team: 'price_team' },
}));

import { Developer } from '../../src/models/index.js';
import { handleWebhookEvent } from '../../src/services/billing.service.js';

const DEVELOPER_ID = 'billing-service-test-developer';

function makeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: 'evt_subscription_update',
    object: 'event',
    api_version: '2025-06-30.basil',
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  } as unknown as Stripe.Event;
}

describe('billing service webhook handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await Developer.create({
      id: DEVELOPER_ID,
      email: 'billing-service@example.com',
      passwordHash: 'test-hash',
      stripeCustomerId: 'cus_billing_test',
    });
  });

  it('syncs the actual Stripe subscription price and safely handles duplicate update events', async () => {
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_team',
      customer: 'cus_billing_test',
      status: 'active',
      metadata: { developerId: DEVELOPER_ID, plan: 'pro' },
      items: { data: [{ price: { id: 'price_team' } }] },
    });
    const event = makeEvent('customer.subscription.updated', { id: 'sub_team' });

    await handleWebhookEvent(event);
    await handleWebhookEvent(event);

    const developer = await Developer.findOne({ id: DEVELOPER_ID });
    expect(developer).toMatchObject({
      plan: 'team',
      stripeSubscriptionId: 'sub_team',
      subscriptionStatus: 'active',
    });
    expect(mockStripeClient.subscriptions.retrieve).toHaveBeenCalledTimes(2);
  });

  it('downgrades cancelled subscriptions to the free plan', async () => {
    await Developer.updateOne(
      { id: DEVELOPER_ID },
      {
        $set: { stripeSubscriptionId: 'sub_cancelled', plan: 'pro', subscriptionStatus: 'active' },
      },
    );
    await handleWebhookEvent(
      makeEvent('customer.subscription.deleted', {
        id: 'sub_cancelled',
        customer: 'cus_billing_test',
        status: 'canceled',
        metadata: { developerId: DEVELOPER_ID },
        items: { data: [{ price: { id: 'price_pro' } }] },
      }),
    );

    const developer = await Developer.findOne({ id: DEVELOPER_ID });
    expect(developer).toMatchObject({ plan: 'free', subscriptionStatus: 'cancelled' });
  });

  it('marks a developer past due when Stripe reports a failed invoice subscription', async () => {
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_pro',
      customer: 'cus_billing_test',
      status: 'past_due',
      metadata: { developerId: DEVELOPER_ID },
      items: { data: [{ price: { id: 'price_pro' } }] },
    });
    await handleWebhookEvent(
      makeEvent('invoice.payment_failed', {
        id: 'in_failed',
        parent: { subscription_details: { subscription: 'sub_pro' } },
      }),
    );

    const developer = await Developer.findOne({ id: DEVELOPER_ID });
    expect(developer).toMatchObject({ plan: 'pro', subscriptionStatus: 'past_due' });
  });
});
