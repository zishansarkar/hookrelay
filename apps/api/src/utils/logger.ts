import { createRequire } from 'node:module';
import pino, { type Logger } from 'pino';
import '../config/loadEnvironmentFile.js';

const require = createRequire(import.meta.url);
const packageMetadata = require('../../../../package.json') as { version: string };
const environment = process.env.NODE_ENV ?? 'development';
const isProduction = environment === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  base: {
    service: 'hookrelay-api',
    environment,
    version: packageMetadata.version,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.x-api-key',
      'headers.authorization',
      'headers.cookie',
      'headers.x-api-key',
      'password',
      'passwordHash',
      'rawKey',
      'token',
    ],
    censor: '[REDACTED]',
  },
  ...(environment === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', singleLine: true },
        },
      }
    : {}),
});

export function createLogger(module: string): Logger {
  return logger.child({ module });
}
