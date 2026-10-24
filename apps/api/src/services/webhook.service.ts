import { randomUUID } from 'node:crypto';
import {
  DeliveryStatus,
  MAX_RETRIES,
  type DeliveryAttempt as DeliveryAttemptRecord,
  type SendWebhookRequest,
  type SendWebhookResponse,
  type WebhookEvent,
} from '@hookrelay/shared';
import { loadConfig } from '../config/environment.js';
import { HttpError } from '../errors/http-error.js';
import { addWebhookJob } from '../queues/webhook.queue.js';
import { DeliveryAttempt, Developer, WebhookEvent as WebhookEventModel } from '../models/index.js';
import { isWithinLimit, trackUsage } from './usage.service.js';

/**
 * Pagination defaults for the events listing endpoint.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Normalises pagination parameters to safe integers.
 */
function normalizePagination(page?: number, limit?: number) {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : DEFAULT_PAGE;
  const rawLimit =
    Number.isInteger(limit) && (limit as number) > 0 ? (limit as number) : DEFAULT_LIMIT;
  const safeLimit = Math.min(rawLimit, MAX_LIMIT);

  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

/**
 * Converts a stored webhook event into the public shape.
 */
function toPublicEvent(event: {
  id: string;
  developerId: string;
  targetUrl: string;
  httpMethod: string;
  headers: Record<string, string>;
  payload: unknown;
  status: DeliveryStatus | string;
  attempts: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WebhookEvent {
  return {
    id: event.id,
    developerId: event.developerId,
    targetUrl: event.targetUrl,
    httpMethod: event.httpMethod as WebhookEvent['httpMethod'],
    headers: event.headers ?? {},
    payload: event.payload,
    status: event.status as DeliveryStatus,
    attempts: event.attempts,
    maxRetries: event.maxRetries,
    nextRetryAt: event.nextRetryAt ?? null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

/**
 * Accepts a webhook for delivery.
 *
 * Does the minimum work before returning: check quota, create the event as
 * QUEUED, increment usage, enqueue attempt 0, respond with eventId.
 */
export async function send(
  developerId: string,
  data: SendWebhookRequest,
): Promise<SendWebhookResponse> {
  const developer = await Developer.findOne({ id: developerId });

  if (!developer) {
    throw new HttpError(401, 'Account no longer exists', 'UNAUTHORIZED');
  }

  if (!(await isWithinLimit(developerId))) {
    throw new HttpError(
      429,
      'Monthly webhook quota exceeded for the current plan',
      'QUOTA_EXCEEDED',
    );
  }

  const config = loadConfig();
  const httpMethod = data.httpMethod ?? 'POST';
  const signingSecret = data.signingSecret ?? config.hmacDefaultSecret ?? '';
  const maxRetries = data.maxRetries ?? MAX_RETRIES;

  const event = await WebhookEventModel.create({
    developerId,
    targetUrl: data.targetUrl,
    httpMethod,
    headers: data.headers ?? {},
    payload: data.payload,
    signingSecret,
    status: DeliveryStatus.QUEUED,
    attempts: 0,
    maxRetries,
    nextRetryAt: null,
  });

  try {
    await addWebhookJob({
      eventId: event.id,
      targetUrl: event.targetUrl,
      httpMethod: event.httpMethod,
      headers: event.headers ?? {},
      payload: event.payload,
      signingSecret,
      attemptNumber: 0,
      maxRetries: event.maxRetries,
      developerId: event.developerId,
      replayId: randomUUID(),
    });
  } catch (error) {
    console.error('[hookrelay-api] failed to enqueue webhook job', error);
    event.status = DeliveryStatus.FAILED;
    await event.save();
    throw new HttpError(
      503,
      'Webhook queue is temporarily unavailable; retry the request',
      'QUEUE_UNAVAILABLE',
    );
  }

  await trackUsage(developerId);

  return {
    eventId: event.id,
    status: 'queued',
    message: 'Webhook queued for delivery',
  };
}

/** Alias kept for backwards compatibility with earlier code. */
export const sendWebhook = send;

export interface ListEventsOptions {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
  targetUrl?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ListedWebhookEvent extends WebhookEvent {
  responseCode: number | null;
  responseTimeMs: number | null;
}

export interface EventStats {
  totalToday: number;
  successful: number;
  failed: number;
  pending: number;
}

/**
 * Paginated list of events with optional filtering.
 */
export async function listEvents(
  developerId: string,
  options: ListEventsOptions = {},
): Promise<{ events: ListedWebhookEvent[]; total: number; page: number; limit: number }> {
  const { page, limit, skip } = normalizePagination(options.page, options.limit);
  const query: Record<string, unknown> = { developerId };

  if (options.status) {
    query.status =
      options.status === DeliveryStatus.PENDING
        ? { $in: [DeliveryStatus.PENDING, DeliveryStatus.QUEUED, DeliveryStatus.DELIVERING] }
        : options.status;
  }

  if (options.targetUrl) {
    query.targetUrl = { $regex: options.targetUrl, $options: 'i' };
  }
  if (options.startDate || options.endDate) {
    query.createdAt = {
      ...(options.startDate ? { $gte: options.startDate } : {}),
      ...(options.endDate ? { $lte: options.endDate } : {}),
    };
  }

  const [events, total] = await Promise.all([
    WebhookEventModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WebhookEventModel.countDocuments(query),
  ]);
  const eventIds = events.map((event) => event.id);
  const latestAttempts = eventIds.length
    ? await DeliveryAttempt.aggregate<{
        _id: string;
        statusCode: number | null;
        responseTimeMs: number | null;
      }>([
        { $match: { eventId: { $in: eventIds } } },
        { $sort: { attemptNumber: -1 } },
        {
          $group: {
            _id: '$eventId',
            statusCode: { $first: '$statusCode' },
            responseTimeMs: { $first: '$responseTimeMs' },
          },
        },
      ])
    : [];
  const latestAttemptByEventId = new Map(latestAttempts.map((attempt) => [attempt._id, attempt]));

  return {
    events: events.map((event) => {
      const publicEvent = toPublicEvent({
        id: event.id,
        developerId: event.developerId,
        targetUrl: event.targetUrl,
        httpMethod: event.httpMethod,
        headers: event.headers ?? {},
        payload: event.payload,
        status: event.status,
        attempts: event.attempts,
        maxRetries: event.maxRetries,
        nextRetryAt: event.nextRetryAt ?? null,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      });
      const latestAttempt = latestAttemptByEventId.get(event.id);
      return {
        ...publicEvent,
        responseCode: latestAttempt?.statusCode ?? null,
        responseTimeMs: latestAttempt?.responseTimeMs ?? null,
      };
    }),
    total,
    page,
    limit,
  };
}

export async function getEventStats(developerId: string): Promise<EventStats> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [totalToday, statusCounts] = await Promise.all([
    WebhookEventModel.countDocuments({ developerId, createdAt: { $gte: todayStart } }),
    WebhookEventModel.aggregate<{ _id: DeliveryStatus; count: number }>([
      { $match: { developerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = new Map(statusCounts.map(({ _id, count }) => [_id, count]));
  return {
    totalToday,
    successful: counts.get(DeliveryStatus.SUCCESS) ?? 0,
    failed: counts.get(DeliveryStatus.FAILED) ?? 0,
    pending:
      (counts.get(DeliveryStatus.PENDING) ?? 0) +
      (counts.get(DeliveryStatus.QUEUED) ?? 0) +
      (counts.get(DeliveryStatus.DELIVERING) ?? 0),
  };
}

/**
 * Fetch a single event with all its delivery attempts.
 */
export async function getEvent(
  developerId: string,
  eventId: string,
): Promise<(WebhookEvent & { deliveryAttempts: DeliveryAttemptRecord[] }) | null> {
  const event = await WebhookEventModel.findOne({ id: eventId, developerId });

  if (!event) {
    return null;
  }

  const attempts = await DeliveryAttempt.find({ eventId }).sort({ attemptNumber: 1 });

  return {
    ...toPublicEvent({
      id: event.id,
      developerId: event.developerId,
      targetUrl: event.targetUrl,
      httpMethod: event.httpMethod,
      headers: event.headers ?? {},
      payload: event.payload,
      status: event.status,
      attempts: event.attempts,
      maxRetries: event.maxRetries,
      nextRetryAt: event.nextRetryAt ?? null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }),
    deliveryAttempts: attempts.map(
      (attempt) => attempt.toJSON() as unknown as DeliveryAttemptRecord,
    ),
  };
}

/**
 * Replay a failed event. Only FAILED or DEAD_LETTER events can be replayed.
 */
export async function replayEvent(developerId: string, eventId: string): Promise<WebhookEvent> {
  const event = await WebhookEventModel.findOne({ id: eventId, developerId });

  if (!event) {
    throw new HttpError(404, 'Event not found', 'NOT_FOUND');
  }

  if (event.status !== DeliveryStatus.FAILED && event.status !== DeliveryStatus.DEAD_LETTER) {
    throw new HttpError(
      409,
      'Only failed or dead-letter events can be replayed',
      'REPLAY_NOT_ALLOWED',
    );
  }

  const config = loadConfig();
  const signingSecret =
    (event.signingSecret as string | undefined) ?? config.hmacDefaultSecret ?? '';

  const previousState = {
    status: event.status,
    attempts: event.attempts,
    nextRetryAt: event.nextRetryAt,
  };
  event.status = DeliveryStatus.QUEUED;
  event.attempts = 0;
  event.nextRetryAt = null;
  await event.save();

  try {
    await addWebhookJob({
      eventId: event.id,
      targetUrl: event.targetUrl,
      httpMethod: event.httpMethod,
      headers: event.headers ?? {},
      payload: event.payload,
      signingSecret,
      attemptNumber: 0,
      maxRetries: event.maxRetries,
      developerId: event.developerId,
    });
  } catch (error) {
    console.error('[hookrelay-api] failed to enqueue replay job', error);
    event.status = previousState.status;
    event.attempts = previousState.attempts;
    event.nextRetryAt = previousState.nextRetryAt;
    await event.save();
    throw new HttpError(503, 'Event replay could not be queued', 'QUEUE_UNAVAILABLE');
  }

  return toPublicEvent({
    id: event.id,
    developerId: event.developerId,
    targetUrl: event.targetUrl,
    httpMethod: event.httpMethod,
    headers: event.headers ?? {},
    payload: event.payload,
    status: event.status,
    attempts: event.attempts,
    maxRetries: event.maxRetries,
    nextRetryAt: event.nextRetryAt ?? null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  });
}
