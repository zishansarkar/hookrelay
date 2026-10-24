import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { type Request } from 'express';
import '../apps/api/src/config/loadEnvironmentFile.js';
import { createLogger } from '../apps/api/src/utils/logger.js';

const PORT = 3002;
const logger = createLogger('demo-receiver');
const app = express();
const attemptsByEventId = new Map<string, number>();

app.use(
  express.json({
    verify: (request, _response, buffer) => {
      (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }),
);

app.use((request, _response, next) => {
  logger.info(
    {
      method: request.method,
      path: request.path,
      headers: request.headers,
      body: request.body,
    },
    'Demo receiver request received',
  );
  next();
});

app.post('/webhook/success', (_request, response) => {
  response.status(200).json({ received: true });
});

app.post('/webhook/slow', (_request, response) => {
  setTimeout(() => response.status(200).json({ received: true, delayedMs: 3000 }), 3_000);
});

app.post('/webhook/fail', (_request, response) => {
  response.status(500).json({ error: 'Internal Server Error' });
});

app.post('/webhook/intermittent', (request, response) => {
  const eventId =
    request.header('x-hookrelay-event-id') ??
    (typeof request.body?.eventId === 'string' ? request.body.eventId : 'unknown-event');
  const attempts = (attemptsByEventId.get(eventId) ?? 0) + 1;
  attemptsByEventId.set(eventId, attempts);

  if (attempts <= 2) {
    response.status(500).json({ error: 'Temporary failure', attempt: attempts, eventId });
    return;
  }

  attemptsByEventId.delete(eventId);
  response.status(200).json({ received: true, eventId, attempts });
});

app.post('/webhook/verify', (request, response) => {
  const signingSecret = process.env.DEMO_HMAC_SECRET ?? process.env.HMAC_DEFAULT_SECRET;
  const signatureHeader = request.header('x-hookrelay-signature-256') ?? '';
  const match = /^t=(\d+),v1=([a-f\d]{64})$/i.exec(signatureHeader);
  let signatureValid = false;

  const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
  if (match && rawBody && signingSecret) {
    const [, timestamp, receivedSignature] = match;
    const expectedSignature = createHmac('sha256', signingSecret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest();
    const actualSignature = Buffer.from(receivedSignature!, 'hex');
    signatureValid =
      actualSignature.length === expectedSignature.length &&
      timingSafeEqual(actualSignature, expectedSignature);
  }

  response.status(200).json({ signatureValid });
});

app.listen(PORT, '127.0.0.1', () => {
  logger.info({ host: '127.0.0.1', port: PORT }, 'Demo webhook receiver listening');
});
