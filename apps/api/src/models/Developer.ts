import { compare, hash } from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { Developer as DeveloperRecord, Plan } from '@hookrelay/shared';

const PLANS: readonly Plan[] = ['free', 'pro', 'team'];

/** bcrypt work factor applied to every stored password. */
const BCRYPT_ROUNDS = 12;

/**
 * Stored representation of a developer.
 *
 * Only the bcrypt hash is ever persisted — the plaintext password never
 * reaches the database.
 */
export interface DeveloperDocument extends DeveloperRecord {
  /** bcrypt hash of the developer's password. Never selected by default. */
  passwordHash: string;
  lastLoginAt: Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | null;
}

/**
 * Hashes a plaintext password with bcrypt.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 */
export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

const DeveloperSchema = new Schema<DeveloperDocument>(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    companyName: { type: String, default: null },
    plan: { type: String, enum: PLANS, required: true, default: 'free' },
    webhooksUsedThisMonth: { type: Number, required: true, default: 0 },
    stripeCustomerId: { type: String, default: undefined, index: true },
    stripeSubscriptionId: { type: String, default: undefined, index: true },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', null],
      default: null,
    },
    lastLoginAt: { type: Date, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.stripeCustomerId;
        delete ret.stripeSubscriptionId;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type DeveloperModel = Model<DeveloperDocument>;
export type DeveloperHydratedDocument = HydratedDocument<DeveloperDocument>;

export const Developer = model<DeveloperDocument>('Developer', DeveloperSchema);
