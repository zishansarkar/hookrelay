import { DeliveryStatus, MAX_RETRIES, type SendWebhookResponse } from '@hookrelay/shared';
import { loadConfig } from '../config/environment.js';
import { HttpError } from '../errors/http-error.js';
import { Developer, WebhookEvent } from '../models/index.js';
import type { SendWebhookInput } from '../validators/webhook.validators.js';

/**
 * Accepts a webhook for delivery.
 *
 * The event is persisted as `queued` inside the ingestion request; the
 * delivery worker picks it up from there. Nothing here performs network I/O
 * against the target URL, which is what keeps ingestion fast.
 */
export async function sendWebhook(
  developerId: string,
  input: SendWebhookInput,
): Promise<SendWebhookResponse> {
  const developer = await Developer.findOne({ id: developerId });

  if (!developer) {
    throw new HttpError(401, 'Account no longer exists', 'UNAUTHORIZED');
  }

  const config = loadConfig();
  const httpMethod = input.httpMethod;
  const signingSecret = input.signingSecret ?? config.hmacDefaultSecret ?? null;

  const event = await WebhookEvent.create({
    developerId,
    targetUrl: input.targetUrl,
    httpMethod,
    headers: input.headers,
    payload: input.payload,
    signingSecret,
    status: DeliveryStatus.QUEUED,
    attempts: 0,
    maxRetries: input.maxRetries ?? MAX_RETRIES,
    nextRetryAt: null,
  });

  // Quota tracking is bookkeeping: a failure here must not reject an event
  // that has already been persisted.
  await Developer.updateOne({ id: developerId }, { $inc: { webhooksUsedThisMonth: 1 } }).catch(
    (error: unknown) => {
      console.error('[hookrelay-api] failed to increment webhook usage', error);
    },
  );

  return {
    eventId: event.id,
    status: 'queued',
    message: 'Webhook queued for delivery',
  };
}
