/**
 * Webhook Events Repository
 * Manages webhook event deduplication via external_event_id UNIQUE constraint
 * Idempotent via ON CONFLICT (external_event_id) DO NOTHING
 */

import { PoolClient } from '@shared/database/connection';

export interface WebhookEvent {
  id: string;
  external_event_id: string;
  event_type: string;
  provider: string;
  payload: Record<string, unknown>;
  processed_at: Date;
}

/**
 * Insert a webhook event using a transaction client
 * Idempotent via ON CONFLICT (external_event_id) DO NOTHING
 * Returns null if event already exists (duplicate webhook delivery)
 */
export async function insertWithClient(
  client: PoolClient,
  externalEventId: string,
  eventType: string,
  provider: string,
  payload: Record<string, unknown>
): Promise<WebhookEvent | null> {
  const result = await client.query<WebhookEvent>(
    `INSERT INTO subscription.webhook_events 
     (external_event_id, event_type, provider, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (external_event_id) DO NOTHING
     RETURNING id, external_event_id, event_type, provider, payload, processed_at`,
    [
      externalEventId,
      eventType,
      provider,
      JSON.stringify(payload),
    ]
  );
  return result.rows[0] || null;
}