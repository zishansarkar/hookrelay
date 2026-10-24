import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DeliveryStatus } from '@hookrelay/shared';
import { validateEnvironment } from '../../src/config/environment.js';
import { DeliveryAttempt, Developer, WebhookEvent } from '../../src/models/index.js';
import { createApp } from '../../src/app.js';

const config = validateEnvironment();
const app = createApp(config);
const developerId = 'events-list-test-developer';
const token = sign(
  { id: developerId, email: 'events-list@example.com', plan: 'free' },
  config.jwtSecret ?? 'test-jwt-secret',
);

describe('event list API', () => {
  it('filters by date and status and includes latest delivery response metadata', async () => {
    await Developer.create({
      id: developerId,
      email: 'events-list@example.com',
      passwordHash: 'test-hash',
    });
    const event = await WebhookEvent.create({
      developerId,
      targetUrl: 'https://receiver.example/hooks',
      httpMethod: 'POST',
      headers: {},
      payload: { event: 'test' },
      status: DeliveryStatus.QUEUED,
      attempts: 1,
      maxRetries: 3,
      createdAt: new Date('2026-10-24T12:00:00.000Z'),
    });
    await DeliveryAttempt.create({
      eventId: event.id,
      attemptNumber: 1,
      statusCode: 202,
      responseBody: 'accepted',
      responseTimeMs: 145,
      error: null,
    });

    const response = await request(app)
      .get('/v1/events')
      .query({
        status: DeliveryStatus.PENDING,
        startDate: '2026-10-24T00:00:00.000Z',
        endDate: '2026-10-25T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.events[0]).toMatchObject({
      id: event.id,
      status: DeliveryStatus.QUEUED,
      responseCode: 202,
      responseTimeMs: 145,
    });
  });

  it('returns all-status summary counts and today total', async () => {
    await Developer.create({
      id: developerId,
      email: 'events-list@example.com',
      passwordHash: 'test-hash',
    });
    await WebhookEvent.create([
      {
        developerId,
        targetUrl: 'https://receiver.example/success',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: DeliveryStatus.SUCCESS,
        createdAt: new Date(),
      },
      {
        developerId,
        targetUrl: 'https://receiver.example/queued',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: DeliveryStatus.QUEUED,
        createdAt: new Date(),
      },
      {
        developerId,
        targetUrl: 'https://receiver.example/failed',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: DeliveryStatus.FAILED,
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get('/v1/events/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      totalToday: 3,
      successful: 1,
      failed: 1,
      pending: 1,
    });
  });

  it('treats target URL search input as a literal and rejects invalid pagination', async () => {
    await Developer.create({
      id: developerId,
      email: 'events-list@example.com',
      passwordHash: 'test-hash',
    });
    await WebhookEvent.create([
      {
        developerId,
        targetUrl: 'https://receiver.example/a.b',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: DeliveryStatus.SUCCESS,
      },
      {
        developerId,
        targetUrl: 'https://receiver.example/axb',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: DeliveryStatus.SUCCESS,
      },
    ]);

    const literalSearch = await request(app)
      .get('/v1/events')
      .query({ targetUrl: 'a.b' })
      .set('Authorization', `Bearer ${token}`);
    expect(literalSearch.status).toBe(200);
    expect(literalSearch.body.data.events).toHaveLength(1);
    expect(literalSearch.body.data.events[0].targetUrl).toBe('https://receiver.example/a.b');

    const invalidPage = await request(app)
      .get('/v1/events')
      .query({ page: '0' })
      .set('Authorization', `Bearer ${token}`);
    expect(invalidPage.status).toBe(400);
    expect(invalidPage.body.code).toBe('VALIDATION_ERROR');
  });

  it('includes captured request and response headers in event delivery details', async () => {
    await Developer.create({
      id: developerId,
      email: 'events-list@example.com',
      passwordHash: 'test-hash',
    });
    const event = await WebhookEvent.create({
      developerId,
      targetUrl: 'https://receiver.example/hooks',
      httpMethod: 'POST',
      headers: { 'x-custom': 'value' },
      payload: { event: 'test' },
      status: DeliveryStatus.FAILED,
    });
    await DeliveryAttempt.create({
      eventId: event.id,
      attemptNumber: 1,
      requestHeaders: {
        'content-type': 'application/json',
        'x-hookrelay-signature-256': 't=123,v1=signature',
      },
      statusCode: 500,
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: '{"error":"failed"}',
      responseTimeMs: 145,
      error: 'Receiver responded with HTTP 500',
    });

    const response = await request(app)
      .get(`/v1/events/${event.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.deliveryAttempts[0]).toMatchObject({
      requestHeaders: {
        'content-type': 'application/json',
        'x-hookrelay-signature-256': 't=123,v1=signature',
      },
      responseHeaders: { 'content-type': 'application/json' },
    });
  });
});
