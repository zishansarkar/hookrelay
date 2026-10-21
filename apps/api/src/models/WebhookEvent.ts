import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  DeliveryStatus,
  MAX_RETRIES,
  type WebhookEvent as WebhookEventRecord,
} from '@hookrelay/shared';

const HTTP_METHODS = ['POST', 'PUT', 'PATCH'] as const;

/**
 * Stored representation of a webhook event.
 *
 * There is deliberately no TTL index: log retention is driven by the cleanup
 * job that runs against `createdAt`.
 */
export type WebhookEventDocument = WebhookEventRecord;

const WebhookEventSchema = new Schema<WebhookEventDocument>(
  {
    id: { type: String, required: true, unique: true, default: () => uuidv4() },
    developerId: { type: String, required: true },
    targetUrl: { type: String, required: true },
    httpMethod: { type: String, enum: HTTP_METHODS, required: true, default: 'POST' },
    headers: { type: Schema.Types.Mixed, required: true, default: () => ({}) },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: DeliveryStatus, required: true, default: DeliveryStatus.PENDING },
    attempts: { type: Number, required: true, default: 0 },
    maxRetries: { type: Number, required: true, default: MAX_RETRIES },
    nextRetryAt: { type: Date, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

WebhookEventSchema.index({ developerId: 1, createdAt: -1 });
WebhookEventSchema.index({ status: 1 });
WebhookEventSchema.index({ nextRetryAt: 1 });

export type WebhookEventModel = Model<WebhookEventDocument>;
export type WebhookEventHydratedDocument = HydratedDocument<WebhookEventDocument>;

export const WebhookEvent = model('WebhookEvent', WebhookEventSchema);
