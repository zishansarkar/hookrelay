import { describe, expect, it } from 'vitest';
import { buildSignatureHeader, signPayload } from '../../src/utils/signing.js';

describe('webhook signing helpers', () => {
  it('produces the expected deterministic signature for a known payload', () => {
    const signature = signPayload({ id: 'evt_1', ok: true }, 'secret', 1_700_000_000);

    expect(signature).toBe('bf269de5b8a9be7cdeb52d841f5da38b609004c515374837583ac7e6278203e2');
  });

  it('formats the signature header using timestamp and v1 fields', () => {
    expect(buildSignatureHeader('abc123', 1_700_000_000)).toBe('t=1700000000,v1=abc123');
  });

  it('produces different signatures for different secrets', () => {
    const payload = { id: 'evt_1' };

    expect(signPayload(payload, 'first-secret', 100)).not.toBe(
      signPayload(payload, 'second-secret', 100),
    );
  });

  it('produces different signatures for different timestamps', () => {
    const payload = { id: 'evt_1' };

    expect(signPayload(payload, 'secret', 100)).not.toBe(signPayload(payload, 'secret', 101));
  });

  it.each([
    ['object', { enabled: true, count: 2 }],
    ['array', ['one', 2, null]],
    ['string', 'webhook payload'],
    ['number', 42],
    ['null', null],
  ])('signs a %s payload', (_type, payload) => {
    expect(signPayload(payload, 'secret', 123)).toMatch(/^[a-f0-9]{64}$/);
  });
});
