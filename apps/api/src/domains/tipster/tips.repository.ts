/**
 * Tips Repository
 * Manages tipster tip data with idempotency by external_id
 */

import { db, PoolClient } from '@shared/database/connection';

export interface Tip {
  id: string;
  external_id: string;
  sport: string;
  league: string | null;
  event_name: string;
  event_starts_at: Date;
  market: string;
  selection: string;
  odds: number;
  stake_units: number;
  confidence: number | null;
  house_slug: string | null;
  status: 'pending' | 'won' | 'lost' | 'void';
  settled_at: Date | null;
  settled_value: number | null;
  tipster_created_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface TipInput {
  external_id: string;
  sport: string;
  league?: string | null;
  event_name: string;
  event_starts_at: Date;
  market: string;
  selection: string;
  odds: number;
  stake_units: number;
  confidence?: number | null;
  house_slug?: string | null;
  tipster_created_at?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface TipFilters {
  status?: 'pending' | 'won' | 'lost' | 'void';
  house_slug?: string;
  since?: Date;
  until?: Date;
}

/**
 * Find a tip by external_id
 */
export async function findByExternalId(externalId: string): Promise<Tip | null> {
  const result = await db.query<Tip>(
    `SELECT id, external_id, sport, league, event_name, event_starts_at, 
            market, selection, odds, stake_units, confidence, house_slug,
            status, settled_at, settled_value, tipster_created_at, 
            metadata, created_at, updated_at
     FROM tipster.tips 
     WHERE external_id = $1`,
    [externalId]
  );
  return result.rows[0] || null;
}

/**
 * Find a tip by id
 */
export async function findById(id: string): Promise<Tip | null> {
  const result = await db.query<Tip>(
    `SELECT id, external_id, sport, league, event_name, event_starts_at, 
            market, selection, odds, stake_units, confidence, house_slug,
            status, settled_at, settled_value, tipster_created_at, 
            metadata, created_at, updated_at
     FROM tipster.tips 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Insert a new tip using a transaction client
 */
export async function insertWithClient(
  client: PoolClient,
  input: TipInput
): Promise<Tip> {
  const result = await client.query<Tip>(
    `INSERT INTO tipster.tips 
     (external_id, sport, league, event_name, event_starts_at, market, selection, 
      odds, stake_units, confidence, house_slug, tipster_created_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, external_id, sport, league, event_name, event_starts_at, 
               market, selection, odds, stake_units, confidence, house_slug,
               status, settled_at, settled_value, tipster_created_at, 
               metadata, created_at, updated_at`,
    [
      input.external_id,
      input.sport,
      input.league ?? null,
      input.event_name,
      input.event_starts_at,
      input.market,
      input.selection,
      input.odds,
      input.stake_units,
      input.confidence ?? null,
      input.house_slug ?? null,
      input.tipster_created_at ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return result.rows[0];
}

/**
 * Settle a tip using a transaction client
 */
export async function settleWithClient(
  client: PoolClient,
  externalId: string,
  status: 'won' | 'lost' | 'void',
  settledValue?: number | null,
  settledAt?: Date
): Promise<Tip> {
  const result = await client.query<Tip>(
    `UPDATE tipster.tips 
     SET status = $2, 
         settled_at = $3, 
         settled_value = $4,
         updated_at = NOW()
     WHERE external_id = $1
     RETURNING id, external_id, sport, league, event_name, event_starts_at, 
               market, selection, odds, stake_units, confidence, house_slug,
               status, settled_at, settled_value, tipster_created_at, 
               metadata, created_at, updated_at`,
    [
      externalId,
      status,
      settledAt ?? new Date(),
      settledValue ?? null,
    ]
  );
  return result.rows[0];
}

/**
 * List all tips with optional filters
 */
export async function listAll(filters?: TipFilters): Promise<Tip[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters?.house_slug) {
    conditions.push(`house_slug = $${paramIndex++}`);
    params.push(filters.house_slug);
  }

  if (filters?.since) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.since);
  }

  if (filters?.until) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.until);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query<Tip>(
    `SELECT id, external_id, sport, league, event_name, event_starts_at, 
            market, selection, odds, stake_units, confidence, house_slug,
            status, settled_at, settled_value, tipster_created_at, 
            metadata, created_at, updated_at
     FROM tipster.tips 
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  );
  return result.rows;
}