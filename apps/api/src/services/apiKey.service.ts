import type { ApiKey as ApiKeyRecord, CreateApiKeyResponse, Plan } from '@hookrelay/shared';
import { createHash } from 'node:crypto';
import { HttpError } from '../errors/http-error.js';
import { API_KEY_PREFIX, ApiKey, Developer, type ApiKeyHydratedDocument } from '../models/index.js';

/** Maximum number of active API keys per developer. */
const MAX_ACTIVE_KEYS = 5;

function toPublicApiKey(apiKey: ApiKeyHydratedDocument): ApiKeyRecord {
  return {
    id: apiKey.id,
    developerId: apiKey.developerId,
    name: apiKey.name,
    keyPrefix: `${API_KEY_PREFIX}****${apiKey.lastFour}`,
    isActive: apiKey.isActive,
    createdAt: apiKey.createdAt,
    lastUsedAt: apiKey.lastUsedAt,
  };
}

/**
 * Issues a new API key. The raw key is returned exactly once.
 * Each developer is limited to 5 active keys.
 */
export async function create(developerId: string, name: string): Promise<CreateApiKeyResponse> {
  const activeCount = await ApiKey.countDocuments({ developerId, isActive: true });
  if (activeCount >= MAX_ACTIVE_KEYS) {
    throw new HttpError(
      400,
      `You can have at most ${MAX_ACTIVE_KEYS} active API keys`,
      'API_KEY_LIMIT_EXCEEDED',
    );
  }

  const { rawKey, hashedKey } = ApiKey.generateKey();

  const apiKey = await ApiKey.create({
    developerId,
    key: hashedKey,
    lastFour: rawKey.slice(-4),
    name,
  });

  return { apiKey: toPublicApiKey(apiKey), rawKey };
}

/**
 * Lists every API key owned by a developer, newest first.
 */
export async function list(developerId: string): Promise<ApiKeyRecord[]> {
  const apiKeys = await ApiKey.find({ developerId }).sort({ createdAt: -1 });

  return apiKeys.map(toPublicApiKey);
}

/**
 * Deactivates an API key. Verifies the key belongs to the developer.
 */
export async function revoke(developerId: string, keyId: string): Promise<ApiKeyRecord> {
  const apiKey = await ApiKey.findOne({ id: keyId, developerId });

  if (!apiKey) {
    throw new HttpError(404, 'API key not found', 'NOT_FOUND');
  }

  if (apiKey.isActive) {
    apiKey.isActive = false;
    await apiKey.save();
  }

  return toPublicApiKey(apiKey);
}

/**
 * Finds and returns the API key and associated developer for a raw key.
 * Updates lastUsedAt. Returns null if not found or inactive.
 */
export async function getByRawKey(rawKey: string): Promise<{
  apiKey: ApiKeyHydratedDocument;
  developer: { id: string; email: string; plan: Plan; webhooksUsedThisMonth: number };
} | null> {
  const hashedKey = createHash('sha256').update(rawKey, 'utf8').digest('hex');

  const apiKey = await ApiKey.findOne({ key: hashedKey, isActive: true });

  if (!apiKey) {
    return null;
  }

  const developer = await Developer.findOne({ id: apiKey.developerId });
  if (!developer) {
    return null;
  }

  // Usage tracking must never slow down ingestion, so it is not awaited.
  void ApiKey.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).catch((error: unknown) => {
    console.error('[hookrelay-api] failed to record API key usage', error);
  });

  return { apiKey, developer };
}
