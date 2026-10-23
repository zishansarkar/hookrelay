import { createHash, randomBytes } from 'node:crypto';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { ApiKey as ApiKeyRecord } from '@hookrelay/shared';

/** Prefix every issued API key carries. */
export const API_KEY_PREFIX = 'hk_live_';

/** Number of random bytes behind the key suffix (16 bytes -> 32 hex chars). */
const API_KEY_RANDOM_BYTES = 16;

/**
 * A freshly generated key. `rawKey` is shown to the developer exactly once;
 * only `hashedKey` is persisted.
 */
export interface GeneratedApiKey {
  rawKey: string;
  hashedKey: string;
}

/**
 * Stored representation of an API key. The `key` column holds the SHA-256
 * hash of the issued key, never the key itself. It is excluded from queries
 * and from JSON output so it cannot leak through the API by accident.
 */
export type ApiKeyDocument = Omit<ApiKeyRecord, 'keyPrefix'> & {
  key: string;
  lastFour: string;
};

/**
 * Placeholder for "no extra instance/query/virtual methods". `{}` is rejected
 * by the repo's lint rules, `Record<never, never>` is the equivalent.
 */
type NoExtraMethods = Record<never, never>;

export interface ApiKeyStatics {
  generateKey(): GeneratedApiKey;
  findByRawKey(rawKey: string): Promise<HydratedDocument<ApiKeyDocument> | null>;
}

/**
 * Hashes a raw API key with SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

const ApiKeySchema = new Schema<
  ApiKeyDocument,
  Model<ApiKeyDocument>,
  NoExtraMethods,
  NoExtraMethods,
  NoExtraMethods,
  ApiKeyStatics
>(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    developerId: { type: String, required: true, index: true },
    key: { type: String, required: true, unique: true, index: true, select: false },
    lastFour: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    lastUsedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        delete ret.key;
        return ret;
      },
    },
  },
);

ApiKeySchema.statics.generateKey = function generateKey(): GeneratedApiKey {
  const rawKey = `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
  return { rawKey, hashedKey: hashApiKey(rawKey) };
};

ApiKeySchema.statics.findByRawKey = function findByRawKey(
  rawKey: string,
): Promise<HydratedDocument<ApiKeyDocument> | null> {
  return ApiKey.findOne({ key: hashApiKey(rawKey), isActive: true });
};

export type ApiKeyModel = Model<ApiKeyDocument> & ApiKeyStatics;
export type ApiKeyHydratedDocument = HydratedDocument<ApiKeyDocument>;

export const ApiKey = model('ApiKey', ApiKeySchema);
