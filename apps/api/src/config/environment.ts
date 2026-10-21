import dotenv from 'dotenv';

dotenv.config();

const NODE_ENVS = ['development', 'test', 'production'] as const;

/**
 * Deployment environment the API is running in.
 */
export type NodeEnv = (typeof NODE_ENVS)[number];

const DEFAULT_PORT = 3001;
const DEFAULT_NODE_ENV: NodeEnv = 'development';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/** Variables that must always be present. */
const REQUIRED_ENV_VARS = ['DATABASE_URL'] as const;

/** Variables that must be present once the app runs in production. */
const PRODUCTION_ENV_VARS = ['JWT_SECRET', 'HMAC_DEFAULT_SECRET'] as const;

/**
 * Fully validated, typed view of the process environment.
 */
export interface AppConfig {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string | null;
  hmacDefaultSecret: string | null;
  frontendUrl: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
}

function isNodeEnv(value: string): value is NodeEnv {
  return (NODE_ENVS as readonly string[]).includes(value);
}

function readNodeEnv(env: NodeJS.ProcessEnv): NodeEnv {
  const raw = (env.NODE_ENV ?? DEFAULT_NODE_ENV).trim().toLowerCase();
  if (!isNodeEnv(raw)) {
    throw new Error(`Invalid NODE_ENV "${raw}". Expected one of: ${NODE_ENVS.join(', ')}.`);
  }
  return raw;
}

function readPort(env: NodeJS.ProcessEnv): number {
  const raw = env.PORT?.trim();
  if (!raw) {
    return DEFAULT_PORT;
  }
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT "${raw}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

function readOptional(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/**
 * Validates the environment and returns the typed configuration.
 *
 * @throws when a required variable is missing or malformed.
 */
export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = readNodeEnv(env);
  const requiredVars =
    nodeEnv === 'production'
      ? [...REQUIRED_ENV_VARS, ...PRODUCTION_ENV_VARS]
      : [...REQUIRED_ENV_VARS];

  const missing = requiredVars.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the missing values.',
    );
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: readPort(env),
    databaseUrl: env.DATABASE_URL!.trim(),
    redisUrl: env.REDIS_URL?.trim() || DEFAULT_REDIS_URL,
    jwtSecret: readOptional(env, 'JWT_SECRET'),
    hmacDefaultSecret: readOptional(env, 'HMAC_DEFAULT_SECRET'),
    frontendUrl: env.FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL,
    stripeSecretKey: readOptional(env, 'STRIPE_SECRET_KEY'),
    stripeWebhookSecret: readOptional(env, 'STRIPE_WEBHOOK_SECRET'),
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Returns the process-wide configuration, validating it on first access.
 */
export function loadConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnvironment();
  }
  return cachedConfig;
}

/**
 * Drops the cached configuration. Used by tests that swap the environment.
 */
export function resetConfig(): void {
  cachedConfig = null;
}
