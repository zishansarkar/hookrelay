import { createHmac } from 'node:crypto';

/**
 * Signs the exact timestamp-prefixed JSON representation sent to the receiver.
 */
export function signPayload(payload: unknown, secret: string, timestamp: number): string {
  const serializedPayload = JSON.stringify(payload);
  if (serializedPayload === undefined) {
    throw new Error('Webhook payload is not JSON serializable');
  }

  return createHmac('sha256', secret).update(`${timestamp}.${serializedPayload}`).digest('hex');
}

/**
 * Formats a signature for the HookRelay signature header.
 */
export function buildSignatureHeader(signature: string, timestamp: number): string {
  return `t=${timestamp},v1=${signature}`;
}
