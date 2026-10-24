import { describe, expect, it } from 'vitest';
import { sanitizeHeaderRecord } from '../../src/middleware/security.js';
import { isPrivateUrl, validateTargetUrl } from '../../src/utils/ssrf-protection.js';

describe('SSRF protection', () => {
  it.each([
    'http://127.0.0.1/hook',
    'http://10.1.2.3/hook',
    'http://172.16.0.1/hook',
    'http://192.168.1.5/hook',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/hook',
    'http://[fc00::1]/hook',
    'http://[fe80::1]/hook',
    'http://[::ffff:127.0.0.1]/hook',
    'http://localhost/hook',
    'http://service.internal/hook',
    'http://printer.local/hook',
  ])('blocks private or internal URL %s', async (url) => {
    await expect(isPrivateUrl(url)).resolves.toBe(true);
    await expect(validateTargetUrl(url)).resolves.toMatchObject({ valid: false });
  });

  it('rejects HTTPS targets that use a disallowed port', async () => {
    await expect(validateTargetUrl('https://1.1.1.1:8443/hook')).resolves.toMatchObject({
      valid: false,
      reason: 'Target URL port must be one of: 80, 443',
    });
  });

  it('requires HTTPS in production', async () => {
    await expect(
      validateTargetUrl('http://1.1.1.1/hook', { isProduction: true }),
    ).resolves.toMatchObject({ valid: false, reason: 'Target URL must use HTTPS in production' });
  });

  it('allows a public IP with an allowed port', async () => {
    await expect(validateTargetUrl('https://1.1.1.1/hook')).resolves.toEqual({ valid: true });
  });
});

describe('outbound header sanitization', () => {
  it('removes credentials, managed headers, and header injection attempts', () => {
    expect(
      sanitizeHeaderRecord({
        Authorization: 'Bearer private',
        Cookie: 'session=private',
        'X-HookRelay-Fake': 'spoofed',
        Host: 'attacker.example',
        'x-good-header': 'safe',
        'x-bad-header': 'first\r\nInjected: yes',
        'x-control-header': 'value\u0000bad',
      }),
    ).toEqual({ 'x-good-header': 'safe' });
  });
});
