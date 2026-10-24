import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_ALLOWED_PORTS = [80, 443] as const;
const INTERNAL_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

export interface TargetUrlOptions {
  isProduction?: boolean;
  allowedPorts?: readonly number[];
}

export interface ResolvedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

function normalizeHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1).toLowerCase()
    : hostname.toLowerCase().replace(/\.$/, '');
}

function ipv4ToNumber(address: string): number | null {
  const octets = address.split('.');
  if (octets.length !== 4) {
    return null;
  }

  let result = 0;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) {
      return null;
    }
    const value = Number(octet);
    if (value > 255) {
      return null;
    }
    result = result * 256 + value;
  }
  return result >>> 0;
}

function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  if (value === null) {
    return true;
  }

  const first = value >>> 24;
  const second = (value >>> 16) & 0xff;
  const third = (value >>> 8) & 0xff;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function ipv6ToBigInt(address: string): bigint | null {
  let normalized = address.toLowerCase().split('%')[0] ?? '';
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const ipv4 = ipv4ToNumber(normalized.slice(lastColon + 1));
    if (lastColon < 0 || ipv4 === null) {
      return null;
    }
    normalized = `${normalized.slice(0, lastColon)}:${((ipv4 >>> 16) & 0xffff).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) {
    return null;
  }
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missingGroups = 8 - left.length - right.length;
  if ((halves.length === 1 && missingGroups !== 0) || missingGroups < 0) {
    return null;
  }
  const groups = [...left, ...Array.from({ length: missingGroups }, () => '0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) {
    return null;
  }

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function isPrivateIpv6(address: string): boolean {
  const value = ipv6ToBigInt(address);
  if (value === null) {
    return true;
  }

  const first16 = Number((value >> 112n) & 0xffffn);
  const first8 = first16 >> 8;
  const first7 = first16 >> 9;
  const first10 = first16 >> 6;
  const first32 = Number(value >> 96n);

  return (
    value === 0n ||
    value === 1n ||
    first7 === 0b1111110 || // fc00::/7 unique-local
    first10 === 0b1111111010 || // fe80::/10 link-local
    first8 === 0xff || // multicast
    (first16 === 0x2001 && (first32 & 0xffffff00) === 0x20010db8) || // documentation
    first16 >> 13 !== 1 // Reject non-global-unicast IPv6 ranges.
  );
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return isPrivateIpv4(address);
  }
  if (family === 6) {
    return isPrivateIpv6(address);
  }
  return true;
}

function isInternalHostname(hostname: string): boolean {
  return (
    INTERNAL_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  );
}

async function resolveHostname(
  hostname: string,
): Promise<Array<{ address: string; family: number }>> {
  const normalized = normalizeHostname(hostname);
  const family = isIP(normalized);
  if (family) {
    return [{ address: normalized, family }];
  }
  return lookup(normalized, { all: true, verbatim: true });
}

/**
 * Returns true for malformed URLs, internal names, DNS failures, and hostnames
 * resolving to any private or special-purpose IP address.
 */
export async function isPrivateUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const hostname = normalizeHostname(parsed.hostname);
    if (isInternalHostname(hostname)) {
      return true;
    }

    const addresses = await resolveHostname(hostname);
    return addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address));
  } catch {
    return true;
  }
}

/**
 * Validates the outbound URL and returns the exact resolved address that must
 * be used for the request, preventing DNS rebinding between validation and
 * connection.
 */
export async function resolveSafeTarget(
  url: string,
  options: TargetUrlOptions = {},
): Promise<{ valid: true; target: ResolvedTarget } | { valid: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Target URL must be a valid absolute URL' };
  }

  const production = options.isProduction ?? process.env.NODE_ENV === 'production';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && !production)) {
    return { valid: false, reason: 'Target URL must use HTTPS in production' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Target URL must not contain credentials' };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isInternalHostname(hostname)) {
    return { valid: false, reason: 'Target URL cannot use an internal hostname' };
  }

  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  if (!allowedPorts.includes(port)) {
    return {
      valid: false,
      reason: `Target URL port must be one of: ${allowedPorts.join(', ')}`,
    };
  }

  try {
    const addresses = await resolveHostname(hostname);
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      return { valid: false, reason: 'Target URL must resolve only to public IP addresses' };
    }
    const selected = addresses[0];
    if (!selected || (selected.family !== 4 && selected.family !== 6)) {
      return { valid: false, reason: 'Target URL hostname did not resolve to a supported IP' };
    }
    return {
      valid: true,
      target: {
        url: parsed,
        address: selected.address,
        family: selected.family,
      },
    };
  } catch {
    return { valid: false, reason: 'Target URL hostname could not be resolved safely' };
  }
}

export async function validateTargetUrl(
  url: string,
  options: TargetUrlOptions = {},
): Promise<{ valid: boolean; reason?: string }> {
  const result = await resolveSafeTarget(url, options);
  return result.valid ? { valid: true } : { valid: false, reason: result.reason };
}
