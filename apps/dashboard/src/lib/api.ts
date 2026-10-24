import axios, { type AxiosError } from 'axios';
import type {
  ApiKey,
  AuthResponse,
  CreateApiKeyResponse,
  Developer,
  DeliveryAttempt,
  DeliveryStatus,
  WebhookEvent,
} from '@hookrelay/shared';

export interface EventListResponse {
  events: ListedWebhookEvent[];
  total: number;
  page: number;
  limit: number;
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

export interface WebhookEventDetail extends WebhookEvent {
  deliveryAttempts: DeliveryAttempt[];
}

export interface UsageResponse {
  used: number;
  limit: number;
  plan: Developer['plan'];
  resetDate: string | Date;
}

export interface EventListParams {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
  targetUrl?: string;
  startDate?: string;
  endDate?: string;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('hookrelay_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hookrelay_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

async function getData<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  return response.data.data;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const result = await getData<AuthResponse>(
      apiClient.post('/v1/auth/login', { email, password }),
    );
    localStorage.setItem('hookrelay_token', result.token);
    return result;
  },
  async register(email: string, password: string, companyName?: string): Promise<AuthResponse> {
    const result = await getData<AuthResponse>(
      apiClient.post('/v1/auth/register', { email, password, companyName }),
    );
    localStorage.setItem('hookrelay_token', result.token);
    return result;
  },
  async getMe(): Promise<Developer> {
    const result = await getData<{ developer: Developer }>(apiClient.get('/v1/auth/me'));
    return result.developer;
  },
};

export const apiKeysApi = {
  async list(): Promise<ApiKey[]> {
    const result = await getData<{ apiKeys: ApiKey[] }>(apiClient.get('/v1/api-keys'));
    return result.apiKeys;
  },
  create(name: string): Promise<CreateApiKeyResponse> {
    return getData(apiClient.post('/v1/api-keys', { name }));
  },
  async revoke(keyId: string): Promise<ApiKey> {
    const result = await getData<{ apiKey: ApiKey }>(
      apiClient.delete(`/v1/api-keys/${encodeURIComponent(keyId)}`),
    );
    return result.apiKey;
  },
};

export const eventsApi = {
  listEvents(params: EventListParams = {}): Promise<EventListResponse> {
    return getData(apiClient.get('/v1/events', { params }));
  },
  list(params: EventListParams = {}): Promise<EventListResponse> {
    return getData(apiClient.get('/v1/events', { params }));
  },
  getEvent(eventId: string): Promise<WebhookEventDetail> {
    return getData(apiClient.get(`/v1/events/${encodeURIComponent(eventId)}`));
  },
  get(eventId: string): Promise<WebhookEventDetail> {
    return getData(apiClient.get(`/v1/events/${encodeURIComponent(eventId)}`));
  },
  getStats(): Promise<EventStats> {
    return getData(apiClient.get('/v1/events/stats'));
  },
  async replay(eventId: string): Promise<WebhookEvent> {
    const result = await getData<{ event: WebhookEvent }>(
      apiClient.post(`/v1/events/${encodeURIComponent(eventId)}/replay`),
    );
    return result.event;
  },
};

export const usageApi = {
  get(): Promise<UsageResponse> {
    return getData(apiClient.get('/v1/usage'));
  },
};
