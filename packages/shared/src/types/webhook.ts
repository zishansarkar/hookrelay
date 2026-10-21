/**
 * Delivery lifecycle of a webhook event.
 *
 * String values keep the status readable in API responses, log lines and the
 * database, and map 1:1 onto the labels shown in the dashboard.
 */
export enum DeliveryStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  DELIVERING = 'delivering',
  SUCCESS = 'success',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter',
}

/**
 * A full webhook event record as shown in the dashboard.
 */
export interface WebhookEvent {
  id: string;
  developerId: string;
  targetUrl: string;
  httpMethod: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  payload: unknown;
  status: DeliveryStatus;
  attempts: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Persisted record of one delivery attempt.
 */
export interface DeliveryAttempt {
  id: string;
  eventId: string;
  attemptNumber: number;
  statusCode: number | null;
  responseBody: string | null;
  responseTimeMs: number | null;
  error: string | null;
  createdAt: Date;
}

/**
 * Outcome of a single delivery attempt, before it is persisted.
 */
export interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
  responseTimeMs: number;
  error: string | null;
}

/**
 * Header values attached to a signed outgoing request.
 */
export interface HmacHeaders {
  'x-hookrelay-signature-256': string;
  'x-hookrelay-timestamp': string;
}
