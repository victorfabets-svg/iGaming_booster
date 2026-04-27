/**
 * WhatsApp Subscribers Repository
 * Manages WhatsApp subscriber data with idempotency by phone_number
 */

import { db, PoolClient } from '@shared/database/connection';

export interface Subscriber {
  id: string;
  user_id: string | null;
  phone_number: string;
  tier: string;
  language: string;
  opted_in_at: Date;
  opted_out_at: Date | null;
  opt_out_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriberInput {
  user_id?: string | null;
  phone_number: string;
  tier?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriberFilters {
  status?: 'active' | 'opted_out' | 'all';
  since?: Date;
}

/**
 * Insert a new subscriber using a transaction client
 * Idempotent via ON CONFLICT (phone_number) DO NOTHING
 * Returns null if subscriber already exists
 */
export async function insertWithClient(
  client: PoolClient,
  input: SubscriberInput
): Promise<Subscriber | null> {
  const result = await client.query<Subscriber>(
    `INSERT INTO whatsapp.subscribers 
     (user_id, phone_number, tier, language, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (phone_number) DO NOTHING
     RETURNING id, user_id, phone_number, tier, language, opted_in_at, opted_out_at, 
              opt_out_reason, metadata, created_at, updated_at`,
    [
      input.user_id ?? null,
      input.phone_number,
      input.tier ?? 'standard',
      input.language ?? 'pt',
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return result.rows[0] || null;
}

/**
 * Opt-out a subscriber using a transaction client
 * Atomic via UPDATE WHERE opted_out_at IS NULL
 * Returns null if already opted out or not found
 */
export async function optOutWithClient(
  client: PoolClient,
  id: string,
  reason: string
): Promise<Subscriber | null> {
  const result = await client.query<Subscriber>(
    `UPDATE whatsapp.subscribers 
     SET opted_out_at = NOW(), opt_out_reason = $2, updated_at = NOW()
     WHERE id = $1 AND opted_out_at IS NULL
     RETURNING id, user_id, phone_number, tier, language, opted_in_at, opted_out_at, 
              opt_out_reason, metadata, created_at, updated_at`,
    [id, reason]
  );
  return result.rows[0] || null;
}

/**
 * Find a subscriber by id
 */
export async function findById(id: string): Promise<Subscriber | null> {
  const result = await db.query<Subscriber>(
    `SELECT id, user_id, phone_number, tier, language, opted_in_at, opted_out_at, 
            opt_out_reason, metadata, created_at, updated_at
     FROM whatsapp.subscribers 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find a subscriber by phone number
 */
export async function findByPhoneNumber(phone: string): Promise<Subscriber | null> {
  const result = await db.query<Subscriber>(
    `SELECT id, user_id, phone_number, tier, language, opted_in_at, opted_out_at, 
            opt_out_reason, metadata, created_at, updated_at
     FROM whatsapp.subscribers 
     WHERE phone_number = $1`,
    [phone]
  );
  return result.rows[0] || null;
}

/**
 * Atomic opt-out by user_id (used by subscription_expired consumer).
 * Returns null if no active subscriber found for that user.
 * Idempotent: already opted-out users return null (handled by caller as no-op).
 */
export async function optOutByUserIdWithClient(
  client: PoolClient,
  userId: string,
  reason: string
): Promise<Subscriber | null> {
  const result = await client.query<Subscriber>(
    `UPDATE whatsapp.subscribers 
     SET opted_out_at = NOW(), opt_out_reason = $2, updated_at = NOW()
     WHERE user_id = $1 AND opted_out_at IS NULL
     RETURNING id, user_id, phone_number, tier, language, opted_in_at, 
               opted_out_at, opt_out_reason, metadata, created_at, updated_at`,
    [userId, reason]
  );
  return result.rows[0] || null;
}

/**
 * List active subscribers (not opted out)
 */
export async function listActive(
  filters?: { since?: Date },
  limit: number = 100
): Promise<Subscriber[]> {
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = ['opted_out_at IS NULL'];

  if (filters?.since) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.since);
  }

  const whereClause = conditions.join(' AND ');
  const limitParam = `$${paramIndex}`;
  params.push(limit);

  const result = await db.query<Subscriber>(
    `SELECT id, user_id, phone_number, tier, language, opted_in_at, opted_out_at, 
            opt_out_reason, metadata, created_at, updated_at
     FROM whatsapp.subscribers 
     WHERE ${whereClause}
     ORDER BY created_at ASC
     LIMIT ${limitParam}`,
    params
  );
  return result.rows;
}

/**
 * List all subscribers with optional filters
 */
export async function listAll(
  filters?: SubscriberFilters,
  limit: number = 100
): Promise<Subscriber[]> {
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = [];

  if (filters?.status === 'active') {
    conditions.push('opted_out_at IS NULL');
  } else if (filters?.status === 'opted_out') {
    conditions.push('opted_out_at IS NOT NULL');
  }
  // 'all' or undefined: no status filter

  if (filters?.since) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.since);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitParam = `$${paramIndex}`;
  params.push(limit);

  const result = await db.query<Subscriber>(
    `SELECT id, user_id, phone_number, tier, language, opted_in_at, opted_out_at, 
            opt_out_reason, metadata, created_at, updated_at
     FROM whatsapp.subscribers 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${limitParam}`,
    params
  );
  return result.rows;
}