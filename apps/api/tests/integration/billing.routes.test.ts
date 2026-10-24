import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/queues/webhook.queue.js', () => ({
  addWebhookJob: vi.fn(),
}));

import { stripe } from '../../src/config/stripe.js';
import { validateEnvironment } from '../../src/config/environment.js';
import { createApp } from '../../src/app.js';

const app = createApp(validateEnvironment());

describe('billing routes', () => {
  it('requires JWT authentication for checkout and portal creation', async () => {
    const checkout = await request(app).post('/v1/billing/checkout').send({ plan: 'pro' });
    const portal = await request(app).post('/v1/billing/portal').send({});
    const metrics = await request(app).get('/v1/metrics');

    expect(checkout.status).toBe(401);
    expect(portal.status).toBe(401);
    expect(metrics.status).toBe(401);
  });

  it('rejects a Stripe webhook with an invalid signature', async () => {
    const response = await request(app)
      .post('/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid-signature')
      .send('{"type":"customer.created"}');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_SIGNATURE');
  });

  it('accepts a validly signed event after receiving the unparsed request body', async () => {
    if (!stripe) throw new Error('Test Stripe client was not initialized');
    const payload = JSON.stringify({
      id: 'evt_test_unhandled',
      object: 'event',
      api_version: '2025-06-30.basil',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cus_test' } },
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: 'customer.created',
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });

    const response = await request(app)
      .post('/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });
});
