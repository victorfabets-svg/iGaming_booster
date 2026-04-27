/**
 * Subscriptions Repository
 * Manages subscription lifecycle with idempotency by external_id
 * and atomic status transitions
 */

import { db, PoolClient } from '@shared/database/connection';

export type SubscriptionStatus = 'pending' | 'active' | 'canceled' | 'expired';

export interface Subscription {
  id: string;
  external_id: string;
  user_id: string | null;
  plan_slug: string;
  status: SubscriptionStatus;
  current_period_start: Date | null;
  current_period_end: Date | null;
  canceled_at: Date | null;
  expired_at: Date | null;
  amount_cents: number | null;
  currency: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionInput {
  external_id: string;
  user_id?: string | null;
  plan_slug: string;
  status?: SubscriptionStatus;
  current_period_start?: Date | null;
  current_period_end?: Date | null;
  amount_cents?: number | null;
  currency?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus;
  user_id?: string;
  plan_slug?: string;
  since?: Date;
}

export interface StatusUpdateFields {
  canceled_at?: Date | null;
  expired_at?: Date | null;
  current_period_start?: Date | null;
  current_period_end?: Date | null;
  amount_cents?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert a new subscription using a transaction client
 * Idempotent via ON CONFLICT (external_id) DO NOTHING
 * Returns null if subscription already exists
 */
export async function insertWithClient(
  client: PoolClient,
  input: SubscriptionInput
): Promise<Subscription | null> {
  const result = await client.query<Subscription>(
    `INSERT INTO subscription.subscriptions 
     (external_id, user_id, plan_slug, status, current_period_start, current_period_end,
      amount_cents, currency, provider, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (external_id) DO NOTHING
     RETURNING id, external_id, user_id, plan_slug, status, current_period_start, 
              current_period_end, canceled_at, expired_at, amount_cents, currency,
              provider, metadata, created_at, updated_at`,
    [
      input.external_id,
      input.user_id ?? null,
      input.plan_slug,
      input.status ?? 'pending',
      input.current_period_start ?? null,
      input.current_period_end ?? null,
      input.amount_cents ?? null,
      input.currency ?? null,
      input.provider ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return result.rows[0] || null;
}

/**
 * Update subscription status with atomic guard
 * 
 * Status transition rules:
 * - 'active': allowed from 'pending' (initial activation) or 'active' (idempotent renew)
 * - 'canceled': allowed from 'active'
 * - 'expired': allowed from 'active' or 'canceled'
 * 
 * Returns null if transition is invalid or subscription not found
 */
export async function updateStatusWithClient(
  client: PoolClient,
  externalId: string,
  newStatus: SubscriptionStatus,
  fields: StatusUpdateFields = {}
): Promise<Subscription | null> {
  // Build SET clause dynamically
  const setClauses: string[] = ['status = $1', 'updated_at = NOW()'];
  const params: unknown[] = [newStatus];
  let paramIndex = 2;

  if (fields.canceled_at !== undefined) {
    setClauses.push(`canceled_at = $${paramIndex++}`);
    params.push(fields.canceled_at);
  }

  if (fields.expired_at !== undefined) {
    setClauses.push(`expired_at = $${paramIndex++}`);
    params.push(fields.expired_at);
  }

  if (fields.current_period_start !== undefined) {
    setClauses.push(`current_period_start = $${paramIndex++}`);
    params.push(fields.current_period_start);
  }

  if (fields.current_period_end !== undefined) {
    setClauses.push(`current_period_end = $${paramIndex++}`);
    params.push(fields.current_period_end);
  }

  if (fields.amount_cents !== undefined) {
    setClauses.push(`amount_cents = $${paramIndex++}`);
    params.push(fields.amount_cents);
  }

  if (fields.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    params.push(JSON.stringify(fields.metadata));
  }

  // Determine allowed previous statuses based on new status
  let allowedStatuses: string[];
  switch (newStatus) {
    case 'active':
      allowedStatuses = ['pending', 'active'];
      break;
    case 'canceled':
      allowedStatuses = ['active'];
      break;
    case 'expired':
      allowedStatuses = ['active', 'canceled'];
      break;
    default:
      allowedStatuses = [newStatus];
  }

  params.push(externalId);
  const externalIdParamIndex = paramIndex;

  const statusPlaceholders = allowedStatuses.map((_, i) => `$${paramIndex + 1 + i}`).join(', ');
  const statusClause = `status IN (${statusPlaceholders})`;

  const result = await client.query<Subscription>(
    `UPDATE subscription.subscriptions 
     SET ${setClauses.join(', ')}
     WHERE external_id = $${externalIdParamIndex} AND ${statusClause}
     RETURNING id, external_id, user_id, plan_slug, status, current_period_start, 
              current_period_end, canceled_at, expired_at, amount_cents, currency,
              provider, metadata, created_at, updated_at`,
    [...params.slice(0, paramIndex), ...allowedStatuses, externalId]
  );
  return result.rows[0] || null;
}

/**
 * FIX-30: Atomic cancel by internal id (admin endpoint uses UUID id, not external_id)
 * Uses WHERE id = $1 AND status = 'active' (atomic guard)
 * Returns null if not found OR not in 'active' state
 */
export async function cancelByIdWithClient(
  client: PoolClient,
  id: string,
  canceledAt: Date,
  metadata: Record<string, unknown>
): Promise<Subscription | null> {
  const result = await client.query<Subscription>(
    `UPDATE subscription.subscriptions 
     SET status = 'canceled',
         canceled_at = $2,
         metadata = metadata || $3::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING id, external_id, user_id, plan_slug, status, current_period_start, 
              current_period_end, canceled_at, expired_at, amount_cents, currency,
              provider, metadata, created_at, updated_at`,
    [id, canceledAt, JSON.stringify(metadata)]
  );
  return result.rows[0] || null;
}

/**
 * Find a subscription by external_id
 */
export async function findByExternalId(externalId: string): Promise<Subscription | null> {
  const result = await db.query<Subscription>(
    `SELECT id, external_id, user_id, plan_slug, status, current_period_start, 
            current_period_end, canceled_at, expired_at, amount_cents, currency,
            provider, metadata, created_at, updated_at
     FROM subscription.subscriptions 
     WHERE external_id = $1`,
    [externalId]
  );
  return result.rows[0] || null;
}

/**
 * Find a subscription by id
 */
export async function findById(id: string): Promise<Subscription | null> {
  const result = await db.query<Subscription>(
    `SELECT id, external_id, user_id, plan_slug, status, current_period_start, 
            current_period_end, canceled_at, expired_at, amount_cents, currency,
            provider, metadata, created_at, updated_at
     FROM subscription.subscriptions 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * List all subscriptions with optional filters
 */
export async function listAll(
  filters?: SubscriptionFilters,
  limit: number = 100
): Promise<Subscription[]> {
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = [];

  if (filters?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters?.user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.user_id);
  }

  if (filters?.plan_slug) {
    conditions.push(`plan_slug = $${paramIndex++}`);
    params.push(filters.plan_slug);
  }

  if (filters?.since) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.since);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitParam = `$${paramIndex}`;
  params.push(limit);

  const result = await db.query<Subscription>(
    `SELECT id, external_id, user_id, plan_slug, status, current_period_start, 
            current_period_end, canceled_at, expired_at, amount_cents, currency,
            provider, metadata, created_at, updated_at
     FROM subscription.subscriptions 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${limitParam}`,
    params
  );
  return result.rows;
}