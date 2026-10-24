import '../apps/api/src/config/loadEnvironmentFile.js';

const apiUrl = (process.env.DEMO_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const receiverUrl = (process.env.DEMO_RECEIVER_URL ?? 'http://127.0.0.1:3002').replace(/\/+$/, '');
const apiKey = process.env.DEMO_API_KEY;
const signingSecret = process.env.DEMO_HMAC_SECRET ?? process.env.HMAC_DEFAULT_SECRET;
const pauseBetweenSendsMs = 700;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWebhook(
  path: string,
  payload: Record<string, unknown>,
  maxRetries = 3,
): Promise<string> {
  if (!apiKey) {
    throw new Error(
      'DEMO_API_KEY is required. Run npm run seed and set the one-time API key it prints in your environment.',
    );
  }
  if (!signingSecret) {
    throw new Error('DEMO_HMAC_SECRET or HMAC_DEFAULT_SECRET is required to sign demo webhooks.');
  }
  const response = await fetch(`${apiUrl}/v1/webhooks/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      targetUrl: `${receiverUrl}/webhook/${path}`,
      httpMethod: 'POST',
      payload,
      signingSecret,
      maxRetries,
    }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Webhook send to /webhook/${path} failed (${response.status}): ${responseText}`,
    );
  }

  const result: unknown = JSON.parse(responseText);
  if (typeof result !== 'object' || result === null) {
    throw new Error(`Unexpected API response while sending /webhook/${path}`);
  }
  const envelope = result as { eventId?: unknown; data?: { eventId?: unknown } };
  const eventId = envelope.data?.eventId ?? envelope.eventId;
  if (typeof eventId !== 'string') {
    throw new Error(`The API response did not include an event ID for /webhook/${path}`);
  }
  return eventId;
}

async function main(): Promise<void> {
  process.stdout.write('Sending demo webhook events to HookRelay...\n');

  for (let index = 1; index <= 3; index += 1) {
    const eventId = await sendWebhook('success', {
      type: 'payment.succeeded',
      paymentId: `pay_demo_${index}`,
      amount: 2499 * index,
      currency: 'USD',
    });
    process.stdout.write(`Accepted success event ${index}/3: ${eventId}\n`);
    await pause(pauseBetweenSendsMs);
  }

  const failedEventId = await sendWebhook('fail', {
    type: 'order.failed-demo',
    orderId: 'ord_demo_failure',
  });
  process.stdout.write(
    `Accepted always-failing event: ${failedEventId} (three retries; dead-letter after the final failure)\n`,
  );
  await pause(pauseBetweenSendsMs);

  const intermittentEventId = await sendWebhook('intermittent', {
    type: 'invoice.payment_succeeded',
    invoiceId: 'inv_demo_intermittent',
  });
  process.stdout.write(
    `Accepted intermittent event: ${intermittentEventId} (receiver fails twice, then succeeds)\n`,
  );
  await pause(pauseBetweenSendsMs);

  const slowEventId = await sendWebhook('slow', {
    type: 'report.generated',
    reportId: 'rpt_demo_slow',
  });
  process.stdout.write(`Accepted slow-response event: ${slowEventId}\n`);
  process.stdout.write(
    'The retry scenarios run asynchronously; the always-failing event reaches dead letter after about 6 minutes.\n',
  );
  process.stdout.write('Open the dashboard at http://localhost:5173 to see the results!\n');
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Demo webhook send failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
