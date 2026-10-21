/**
 * Subscription plans available to a developer.
 */
export type Plan = 'free' | 'pro' | 'team';

/**
 * A developer account that owns API keys and webhook events.
 */
export interface Developer {
  id: string;
  email: string;
  passwordHash: string;
  companyName: string | null;
  plan: Plan;
  webhooksUsedThisMonth: number;
  createdAt: Date;
}

/**
 * A developer-owned API key used to authenticate ingestion requests.
 */
export interface ApiKey {
  id: string;
  developerId: string;
  key: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Payload accepted by `POST /v1/webhooks/send`.
 */
export interface SendWebhookRequest {
  targetUrl: string;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  payload: unknown;
  signingSecret?: string;
  maxRetries?: number;
}

/**
 * Response returned immediately after accepting a webhook for delivery.
 */
export interface SendWebhookResponse {
  eventId: string;
  status: 'queued';
  message: string;
}

/**
 * Shape of every error body returned by the API.
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}
