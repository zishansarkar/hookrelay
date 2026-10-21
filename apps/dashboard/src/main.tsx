/**
 * HookRelay dashboard entrypoint.
 * React / ReactDOM are added in the next milestone — this stub keeps the
 * file tree valid and lets the shared package resolve correctly.
 */
import { DeliveryStatus, type WebhookEvent } from '@hookrelay/shared';

const demoEvent: Pick<WebhookEvent, 'id' | 'status' | 'targetUrl'> = {
  id: 'evt_scaffold',
  status: DeliveryStatus.PENDING,
  targetUrl: 'https://example.com/webhook',
};

// eslint-disable-next-line no-console
console.info('[hookrelay-dashboard] scaffold loaded', demoEvent);
