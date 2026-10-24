import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Developer, WebhookEvent } from '../../src/models/index.js';
import { validateEnvironment } from '../../src/config/environment.js';
import { createApp } from '../../src/app.js';

const config = validateEnvironment();
const app = createApp(config);
const developerId = 'daily-usage-test-developer';
const token = sign(
  { id: developerId, email: 'daily-usage@example.com', plan: 'free' },
  config.jwtSecret ?? 'test-jwt-secret',
);

describe('daily usage API', () => {
  it('returns a 30-day UTC series with zero-filled dates scoped to the developer', async () => {
    await Developer.create({
      id: developerId,
      email: 'daily-usage@example.com',
      passwordHash: 'test-hash',
    });
    await WebhookEvent.create([
      {
        developerId,
        targetUrl: 'https://receiver.example/one',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: 'queued',
        createdAt: new Date(),
      },
      {
        developerId,
        targetUrl: 'https://receiver.example/two',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: 'success',
        createdAt: new Date(),
      },
      {
        developerId: 'another-developer',
        targetUrl: 'https://receiver.example/other',
        httpMethod: 'POST',
        headers: {},
        payload: {},
        status: 'success',
        createdAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get('/v1/usage/daily')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.dailyUsage).toHaveLength(30);
    expect(response.body.data.dailyUsage.at(-1)).toMatchObject({
      date: new Date().toISOString().slice(0, 10),
      count: 2,
    });
    expect(response.body.data.dailyUsage[0]).toMatchObject({
      date: expect.any(String),
      count: 0,
    });
  });
});
