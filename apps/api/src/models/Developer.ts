import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { Developer as DeveloperRecord, Plan } from '@hookrelay/shared';

const PLANS: readonly Plan[] = ['free', 'pro', 'team'];

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const PASSWORD_SCHEME = 'scrypt';

/**
 * Stored representation of a developer. `password` holds the plaintext secret
 * captured at signup and is never serialized — the pre-validate hook below
 * replaces it with a scrypt hash in `passwordHash`.
 */
export interface DeveloperDocument extends DeveloperRecord {
  password: string;
}

/**
 * Hashes a plaintext password with scrypt.
 *
 * Format: `scrypt:<salt hex>:<hash hex>`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derived = scryptSync(password, salt, PASSWORD_KEY_BYTES);
  return `${PASSWORD_SCHEME}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored hash. Returns `false` for
 * malformed hashes instead of throwing.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, saltHex, hashHex] = storedHash.split(':');
  if (scheme !== PASSWORD_SCHEME || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

const DeveloperSchema = new Schema<DeveloperDocument>(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    passwordHash: { type: String, required: true, default: '' },
    companyName: { type: String, default: null },
    plan: { type: String, enum: PLANS, required: true, default: 'free' },
    webhooksUsedThisMonth: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Runs before validation so that `passwordHash` is populated when the
// `required` validator on it runs.
DeveloperSchema.pre('validate', async function (this: DeveloperHydratedDocument): Promise<void> {
  if (!this.isModified('password')) {
    return;
  }

  this.passwordHash = hashPassword(this.password);
});

export type DeveloperModel = Model<DeveloperDocument>;
export type DeveloperHydratedDocument = HydratedDocument<DeveloperDocument>;

export const Developer = model<DeveloperDocument>('Developer', DeveloperSchema);
