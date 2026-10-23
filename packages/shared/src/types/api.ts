/**
 * Subscription plans available to a developer.
 */
export type Plan = 'free' | 'pro' | 'team';

/**
 * A developer account that owns API keys and webhook events.
 *
 * This is the public shape returned by the API — credentials never appear
 * here.
 */
export interface Developer {
  id: string;
  email: string;
  companyName: string | null;
  plan: Plan;
  webhooksUsedThisMonth: number;
  createdAt: Date;
}

/**
 * A developer-owned API key used to authenticate ingestion requests.
 *
 * The raw key is only ever returned once, when it is created. This public
 * shape carries no key material beyond the masked prefix, which is suitable
 * for display in the dashboard.
 */
export interface ApiKey {
  id: string;
  developerId: string;
  name: string;
  /** Masked form of the key, e.g. `hk_live_****a1b2`. */
  keyPrefix: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Payload accepted by `POST /v1/api-keys`.
 */
export interface CreateApiKeyRequest {
  name: string;
}

/**
 * Result of creating an API key. `rawKey` cannot be retrieved again.
 */
export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  rawKey: string;
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

/**
 * Shape of every successful response body returned by the API.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Result of a successful registration or login.
 */
export interface AuthResponse {
  developer: Developer;
  token: string;
}
