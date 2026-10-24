import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { Worker } from 'bullmq';
import {
  DeliveryStatus,
  QUEUE_NAMES,
  MAX_PAYLOAD_SIZE_BYTES,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type DeliveryResult,
} from '@hookrelay/shared';
import { loadConfig } from '../config/environment.js';
import { getRedisConnection } from '../config/redis.js';
import { DeliveryAttempt, WebhookEvent } from '../models/index.js';
import { addWebhookJob, getRetryDelayMs, type WebhookJobData } from '../queues/webhook.queue.js';
import { moveToDeadLetter } from '../queues/dead-letter.queue.js';
import { buildSignatureHeader, signPayload } from '../utils/signing.js';
import { resolveSafeTarget } from '../utils/ssrf-protection.js';
import { sanitizeHeaderRecord } from '../middleware/security.js';

const DELIVERY_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BODY_BYTES = 100 * 1024;

interface HttpResponseResult {
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
}

interface AttemptDeliveryResult extends DeliveryResult {
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
}

function normalizeResponseHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]),
  );
}

function readResponseBody(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const resolveBody = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    };

    response.on('data', (chunk: Buffer | string) => {
      if (settled) {
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = MAX_RESPONSE_BODY_BYTES - totalBytes;
      if (remaining > 0) {
        const accepted = buffer.subarray(0, remaining);
        chunks.push(accepted);
        totalBytes += accepted.length;
      }
      if (buffer.length > remaining) {
        resolveBody();
        response.destroy();
      }
    });
    response.on('end', resolveBody);
    response.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    response.on('aborted', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Receiver closed the response before it completed'));
      }
    });
  });
}

async function sendHttpRequest(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: string,
  isProduction: boolean,
): Promise<HttpResponseResult> {
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !isProduction)) {
    throw new Error('Target URL must use HTTPS in production');
  }
  if (url.username || url.password) {
    throw new Error('Target URL must not contain credentials');
  }

  const destinationResult = await resolveSafeTarget(url.toString(), { isProduction });
  if (!destinationResult.valid) {
    throw new Error(destinationResult.reason);
  }
  const destination = destinationResult.target;
  const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
    callback(null, destination.address, destination.family);
  };
  const requestOptions: RequestOptions = {
    method,
    headers,
    lookup: pinnedLookup,
  };
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const outgoing = request(url, requestOptions, (response) => {
      void readResponseBody(response).then((responseBody) => {
        resolve({
          statusCode: response.statusCode ?? 0,
          responseHeaders: normalizeResponseHeaders(response.headers),
          responseBody,
        });
      }, reject);
    });

    outgoing.setTimeout(DELIVERY_TIMEOUT_MS, () => {
      outgoing.destroy(new Error(`Delivery timed out after ${DELIVERY_TIMEOUT_MS}ms`));
    });
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

function serializePayload(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  if (serialized === undefined) {
    throw new Error('Webhook payload is not JSON serializable');
  }
  return serialized;
}

async function deliver(
  jobData: WebhookJobData,
  isProduction: boolean,
): Promise<AttemptDeliveryResult | null> {
  const event = await WebhookEvent.findOneAndUpdate(
    {
      id: jobData.eventId,
      developerId: jobData.developerId,
      attempts: jobData.attemptNumber,
      status: {
        $in: [DeliveryStatus.QUEUED, DeliveryStatus.PENDING, DeliveryStatus.DELIVERING],
      },
    },
    {
      $set: {
        status: DeliveryStatus.DELIVERING,
        nextRetryAt: null,
      },
    },
    { returnDocument: 'after' },
  ).select('+signingSecret');

  if (!event) {
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'Skipping missing, cancelled, or stale delivery job',
        eventId: jobData.eventId,
        attemptNumber: jobData.attemptNumber,
        targetUrl: jobData.targetUrl,
        status: 'skipped',
        responseTimeMs: 0,
      }),
    );
    return null;
  }

  const payload = serializePayload(jobData.payload);
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_SIZE_BYTES) {
    throw new Error(`Webhook payload exceeds ${MAX_PAYLOAD_SIZE_BYTES} bytes`);
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signingSecret =
    event.signingSecret || jobData.signingSecret || loadConfig().hmacDefaultSecret || '';
  const signature = signPayload(jobData.payload, signingSecret, timestamp);
  const headers = sanitizeHeaderRecord(jobData.headers);
  headers['content-type'] = 'application/json';
  headers['user-agent'] = 'HookRelay/1.0';
  headers['x-hookrelay-event-id'] = jobData.eventId;
  headers[TIMESTAMP_HEADER] = String(timestamp);
  headers[SIGNATURE_HEADER] = buildSignatureHeader(signature, timestamp);

  const startedAt = performance.now();
  try {
    const response = await sendHttpRequest(
      new URL(jobData.targetUrl),
      jobData.httpMethod,
      headers,
      payload,
      isProduction,
    );
    const responseTimeMs = Math.round(performance.now() - startedAt);
    const success = response.statusCode >= 200 && response.statusCode < 300;
    return {
      success,
      statusCode: response.statusCode,
      requestHeaders: headers,
      responseHeaders: response.responseHeaders,
      responseBody: response.responseBody,
      responseTimeMs,
      error: success ? null : `Receiver responded with HTTP ${response.statusCode}`,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: null,
      requestHeaders: headers,
      responseHeaders: {},
      responseBody: null,
      responseTimeMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function processWebhookJob(data: WebhookJobData): Promise<void> {
  const startedAt = performance.now();
  let result: DeliveryResult | null = null;
  let processingError: string | null = null;
  try {
    result = await deliver(data, loadConfig().isProduction);
  } catch (error) {
    processingError = error instanceof Error ? error.message : String(error);
    result = {
      success: false,
      statusCode: null,
      requestHeaders: {},
      responseHeaders: {},
      responseBody: null,
      responseTimeMs: Math.round(performance.now() - startedAt),
      error: processingError,
    };
  }
  if (!result) {
    return;
  }

  const currentAttempt = data.attemptNumber + 1;

  try {
    await DeliveryAttempt.create({
      eventId: data.eventId,
      attemptNumber: currentAttempt,
      requestHeaders: result.requestHeaders,
      statusCode: result.statusCode,
      responseHeaders: result.responseHeaders,
      responseBody: result.responseBody?.slice(0, MAX_RESPONSE_BODY_BYTES) ?? null,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to record delivery attempt',
        eventId: data.eventId,
        attemptNumber: currentAttempt,
        targetUrl: data.targetUrl,
        status: 'attempt_record_failed',
        responseTimeMs: result.responseTimeMs,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return;
  }

  try {
    if (result.success) {
      await WebhookEvent.updateOne(
        { id: data.eventId, developerId: data.developerId, status: DeliveryStatus.DELIVERING },
        {
          $set: {
            status: DeliveryStatus.SUCCESS,
            attempts: currentAttempt,
            nextRetryAt: null,
          },
        },
      );
    } else if (data.attemptNumber < data.maxRetries) {
      const nextAttempt = data.attemptNumber + 1;
      const delayMs = getRetryDelayMs(nextAttempt) ?? 0;
      await WebhookEvent.updateOne(
        { id: data.eventId, developerId: data.developerId, status: DeliveryStatus.DELIVERING },
        {
          $set: {
            status: DeliveryStatus.PENDING,
            attempts: currentAttempt,
            nextRetryAt: new Date(Date.now() + delayMs),
          },
        },
      );
      try {
        await addWebhookJob({
          ...data,
          attemptNumber: nextAttempt,
        });
      } catch (error) {
        await WebhookEvent.updateOne(
          { id: data.eventId, developerId: data.developerId, status: DeliveryStatus.PENDING },
          { $set: { status: DeliveryStatus.FAILED, nextRetryAt: null } },
        );
        throw error;
      }
    } else {
      await WebhookEvent.updateOne(
        { id: data.eventId, developerId: data.developerId, status: DeliveryStatus.DELIVERING },
        {
          $set: {
            status: DeliveryStatus.DEAD_LETTER,
            attempts: currentAttempt,
            nextRetryAt: null,
          },
        },
      );
      await moveToDeadLetter(data.eventId, result.error ?? 'Delivery failed');
    }
  } catch (error) {
    processingError = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to finalize delivery job',
        eventId: data.eventId,
        attemptNumber: currentAttempt,
        targetUrl: data.targetUrl,
        status: 'processing_error',
        responseTimeMs: result.responseTimeMs,
        error: processingError,
      }),
    );
  }

  console.info(
    JSON.stringify({
      level: result.success ? 'info' : 'warn',
      message: result.success ? 'Webhook delivered' : 'Webhook delivery attempt failed',
      eventId: data.eventId,
      attemptNumber: currentAttempt,
      targetUrl: data.targetUrl,
      status: result.success
        ? DeliveryStatus.SUCCESS
        : data.attemptNumber < data.maxRetries
          ? DeliveryStatus.PENDING
          : DeliveryStatus.DEAD_LETTER,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      error: processingError ?? result.error,
    }),
  );
}

export function createDeliveryWorker(): Worker<WebhookJobData, void, string> {
  const config = loadConfig();
  return new Worker<WebhookJobData, void, string>(
    QUEUE_NAMES.delivery,
    (job) => processWebhookJob(job.data),
    {
      connection: getRedisConnection(),
      concurrency: config.workerConcurrency,
      autorun: true,
      limiter: {
        max: 100,
        duration: 10_000,
      },
    },
  );
}
