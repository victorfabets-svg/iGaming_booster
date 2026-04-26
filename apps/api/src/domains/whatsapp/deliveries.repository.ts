/**
 * WhatsApp Deliveries Repository
 * Manages delivery status tracking with idempotency by (tip_id, subscriber_id, message_type)
 */

import { db, PoolClient } from '@shared/database/connection';

export interface Delivery {
  id: string;
  tip_id: string | null;
  subscriber_id: string;
  message_type: 'tip_alert' | 'settlement_alert';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: Date;
  error_code: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryInput {
  tip_id?: string | null;
  subscriber_id: string;
  message_type: 'tip_alert' | 'settlement_alert';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: Date;
  error_code?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DeliveryFilters {
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  since?: Date;
}

/**
 * Upsert a delivery using a transaction client
 * Idempotent via ON CONFLICT (tip_id, subscriber_id, message_type) DO UPDATE
 * Returns the delivery record
 */
export async function upsertWithClient(
  client: PoolClient,
  input: DeliveryInput
): Promise<Delivery> {
  const result = await client.query<Delivery>(
    `INSERT INTO whatsapp.deliveries 
     (tip_id, subscriber_id, message_type, status, sent_at, error_code, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tip_id, subscriber_id, message_type) 
     DO UPDATE SET 
       status = EXCLUDED.status,
       sent_at = EXCLUDED.sent_at,
       error_code = EXCLUDED.error_code,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id, tip_id, subscriber_id, message_type, status, sent_at, 
               error_code, metadata, created_at, updated_at`,
    [
      input.tip_id ?? null,
      input.subscriber_id,
      input.message_type,
      input.status,
      input.sent_at,
      input.error_code ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return result.rows[0];
}

/**
 * List deliveries by tip_id
 */
export async function listByTip(tipId: string, limit: number = 500): Promise<Delivery[]> {
  const limitParam = `$1`;
  const result = await db.query<Delivery>(
    `SELECT id, tip_id, subscriber_id, message_type, status, sent_at, 
            error_code, metadata, created_at, updated_at
     FROM whatsapp.deliveries 
     WHERE tip_id = ${limitParam}
     ORDER BY created_at ASC
     LIMIT $2`,
    [tipId, limit]
  );
  return result.rows;
}

/**
 * List all deliveries with optional filters
 */
export async function listAll(
  filters?: DeliveryFilters,
  limit: number = 100
): Promise<Delivery[]> {
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = [];

  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters?.since) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.since);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitParam = `$${paramIndex}`;
  params.push(limit);

  const result = await db.query<Delivery>(
    `SELECT id, tip_id, subscriber_id, message_type, status, sent_at, 
            error_code, metadata, created_at, updated_at
     FROM whatsapp.deliveries 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${limitParam}`,
    params
  );
  return result.rows;
}