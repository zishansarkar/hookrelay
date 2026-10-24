import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { DeliveryAttempt as DeliveryAttemptRecord } from '@hookrelay/shared';

/**
 * Stored representation of a single delivery attempt.
 */
export type DeliveryAttemptDocument = DeliveryAttemptRecord;

const DeliveryAttemptSchema = new Schema<DeliveryAttemptDocument>(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    eventId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true },
    requestHeaders: { type: Schema.Types.Mixed, default: undefined },
    statusCode: { type: Number, default: null },
    responseHeaders: { type: Schema.Types.Mixed, default: undefined },
    responseBody: { type: String, default: null },
    responseTimeMs: { type: Number, default: null },
    error: { type: String, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type DeliveryAttemptModel = Model<DeliveryAttemptDocument>;
export type DeliveryAttemptHydratedDocument = HydratedDocument<DeliveryAttemptDocument>;

export const DeliveryAttempt = model('DeliveryAttempt', DeliveryAttemptSchema);
