import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../../src/config/environment.js';
import { createApp } from '../../src/app.js';
import { buildSignatureHeader, signPayload } from '../../src/utils/signing.js';

const config = validateEnvironment();
const app = createApp(config);
const token = sign(
  { id: 'verification-developer', email: 'verify@example.com', plan: 'free' },
  config.jwtSecret ?? 'test-jwt-secret',
);

describe('signature verification endpoints', () => {
  it('returns the verification guide with examples for all supported languages', async () => {
    const response = await request(app).get('/v1/docs/verification');

    expect(response.status).toBe(200);
    expect(response.body.data.signatureFormat).toBe('t=<timestamp>,v1=<hmac_hex>');
    expect(response.body.data.examples).toEqual(
      expect.objectContaining({
        nodejs: expect.any(String),
        python: expect.any(String),
        go: expect.any(String),
        ruby: expect.any(String),
      }),
    );
    expect(response.body.data.examples.nodejs).toContain('^t=(\\d+),v1=');
    expect(response.headers['x-request-id']).toMatch(/^[a-zA-Z0-9._:-]{1,128}$/);
  });

  it('preserves a valid request ID supplied by the caller', async () => {
    const response = await request(app)
      .get('/v1/docs/verification')
      .set('x-request-id', 'trace_id-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('trace_id-123');
  });

  it('verifies a current signature when called with a valid JWT', async () => {
    const payload = { event: 'test', id: 'evt_test' };
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = 'verification-test-secret';
    const signature = signPayload(payload, secret, timestamp);

    const response = await request(app)
      .post('/v1/webhooks/test')
      .set('Authorization', `Bearer ${token}`)
      .send({
        signingSecret: secret,
        headers: {
          'x-hookrelay-signature-256': buildSignatureHeader(signature, timestamp),
          'x-hookrelay-timestamp': String(timestamp),
        },
        body: payload,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ valid: true });
  });

  it('rejects stale timestamps and mismatched signatures', async () => {
    const payload = { event: 'test' };
    const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
    const response = await request(app)
      .post('/v1/webhooks/test')
      .set('Authorization', `Bearer ${token}`)
      .send({
        signingSecret: 'verification-test-secret',
        headers: {
          'x-hookrelay-signature-256': buildSignatureHeader('0'.repeat(64), staleTimestamp),
          'x-hookrelay-timestamp': String(staleTimestamp),
        },
        body: payload,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.valid).toBe(false);
    expect(response.body.data.reason).toContain('5-minute');
  });
});
