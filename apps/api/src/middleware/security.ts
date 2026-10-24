import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const BLOCKED_OUTBOUND_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'proxy-authenticate',
  'proxy-connection',
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'expect',
  'keep-alive',
  'te',
  'trailer',
  'upgrade',
]);

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~\da-z-]+$/i;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

function containsHeaderControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function ipv4Number(ip: string): number | null {
  const parts = normalizeIp(ip).split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return null;
  }
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return null;
  }
  return octets.reduce((number, octet) => number * 256 + octet, 0) >>> 0;
}

function matchesWhitelist(clientIp: string, allowedIp: string): boolean {
  const [networkAddress, prefixText] = allowedIp.split('/');
  if (!networkAddress) {
    return false;
  }

  const normalizedClientIp = normalizeIp(clientIp);
  const normalizedNetworkIp = normalizeIp(networkAddress);
  if (prefixText === undefined) {
    return normalizedClientIp === normalizedNetworkIp;
  }

  const client = ipv4Number(normalizedClientIp);
  const network = ipv4Number(normalizedNetworkIp);
  const prefix = Number(prefixText);
  if (
    client === null ||
    network === null ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (client & mask) === (network & mask);
}

/**
 * Restricts a route to configured client IP addresses or IPv4 CIDR ranges.
 * The app's `trust proxy` setting remains disabled unless deployment config
 * explicitly changes it, so `req.ip` is not taken from untrusted forwarded
 * headers by default.
 */
export function ipWhitelist(allowedIps: string[]): RequestHandler {
  const entries = allowedIps.map((ip) => ip.trim()).filter(Boolean);
  return (req, res, next) => {
    const clientIp = req.ip;
    if (clientIp && entries.some((entry) => matchesWhitelist(clientIp, entry))) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Request IP is not allowed',
      code: 'IP_NOT_ALLOWED',
    });
  };
}

/**
 * Adds a safe request identifier to the request and response for log tracing.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const suppliedId = req.get('x-request-id');
  const requestId = suppliedId && REQUEST_ID_PATTERN.test(suppliedId) ? suppliedId : randomUUID();

  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;
  next();
};

/**
 * Sanitizes caller-provided outbound headers, removing credentials and
 * transport-managed headers and rejecting malformed names or values.
 */
export function sanitizeHeaderRecord(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalizedName = name.toLowerCase();
    if (
      BLOCKED_OUTBOUND_HEADERS.has(normalizedName) ||
      normalizedName.startsWith('x-hookrelay-') ||
      !HEADER_NAME_PATTERN.test(name) ||
      containsHeaderControl(value)
    ) {
      continue;
    }
    sanitized[normalizedName] = value;
  }
  return sanitized;
}

/**
 * Removes sensitive and malformed headers from the incoming webhook request
 * before it is validated and queued for forwarding.
 */
export const sanitizeHeaders: RequestHandler = (req, _res, next) => {
  const body = req.body as { headers?: unknown } | undefined;
  if (
    body &&
    typeof body.headers === 'object' &&
    body.headers !== null &&
    !Array.isArray(body.headers)
  ) {
    const entries = Object.entries(body.headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    body.headers = sanitizeHeaderRecord(Object.fromEntries(entries));
  }
  next();
};
