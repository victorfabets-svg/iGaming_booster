/**
 * Plans Repository
 * Manages subscription plans with idempotency by slug
 */

import { db, PoolClient } from '@shared/database/connection';

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface PlanInput {
  slug: string;
  name: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  metadata?: Record<string, unknown>;
}

export interface PlanUpdate {
  name?: string;
  description?: string | null;
  price_cents?: number;
  metadata?: Record<string, unknown>;
}

export interface PlanFilters {
  active?: boolean;
}

/**
 * Insert a new plan using a transaction client
 * Idempotent via ON CONFLICT (slug) DO NOTHING
 * Returns null if plan already exists
 */
export async function insertWithClient(
  client: PoolClient,
  input: PlanInput
): Promise<Plan | null> {
  const result = await client.query<Plan>(
    `INSERT INTO subscription.plans 
     (slug, name, description, price_cents, currency, billing_cycle, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (slug) DO NOTHING
     RETURNING id, slug, name, description, price_cents, currency, billing_cycle, 
               active, metadata, created_at, updated_at`,
    [
      input.slug,
      input.name,
      input.description ?? null,
      input.price_cents,
      input.currency,
      input.billing_cycle,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return result.rows[0] || null;
}

/**
 * Update plan fields (atomic update)
 * Only updates mutable fields: name, description, price_cents, metadata
 * Returns null if plan not found
 */
export async function updateWithClient(
  client: PoolClient,
  slug: string,
  update: PlanUpdate
): Promise<Plan | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (update.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(update.name);
  }

  if (update.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    params.push(update.description);
  }

  if (update.price_cents !== undefined) {
    setClauses.push(`price_cents = $${paramIndex++}`);
    params.push(update.price_cents);
  }

  if (update.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    params.push(JSON.stringify(update.metadata));
  }

  params.push(slug);
  const whereParamIndex = paramIndex;

  const result = await client.query<Plan>(
    `UPDATE subscription.plans 
     SET ${setClauses.join(', ')}
     WHERE slug = $${whereParamIndex}
     RETURNING id, slug, name, description, price_cents, currency, billing_cycle, 
               active, metadata, created_at, updated_at`,
    params
  );
  return result.rows[0] || null;
}

/**
 * Deactivate a plan (atomic via WHERE active = true)
 * Returns null if already inactive or not found
 */
export async function deactivateWithClient(
  client: PoolClient,
  slug: string
): Promise<Plan | null> {
  const result = await client.query<Plan>(
    `UPDATE subscription.plans 
     SET active = false, updated_at = NOW()
     WHERE slug = $1 AND active = true
     RETURNING id, slug, name, description, price_cents, currency, billing_cycle, 
               active, metadata, created_at, updated_at`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Reactivate a plan (atomic via WHERE active = false)
 * Returns null if already active or not found
 */
export async function reactivateWithClient(
  client: PoolClient,
  slug: string
): Promise<Plan | null> {
  const result = await client.query<Plan>(
    `UPDATE subscription.plans 
     SET active = true, updated_at = NOW()
     WHERE slug = $1 AND active = false
     RETURNING id, slug, name, description, price_cents, currency, billing_cycle, 
               active, metadata, created_at, updated_at`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Find a plan by slug
 */
export async function findBySlug(slug: string): Promise<Plan | null> {
  const result = await db.query<Plan>(
    `SELECT id, slug, name, description, price_cents, currency, billing_cycle, 
            active, metadata, created_at, updated_at
     FROM subscription.plans 
     WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * List all plans with optional filters
 */
export async function listAll(
  filters?: PlanFilters,
  limit: number = 100
): Promise<Plan[]> {
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = [];

  if (filters?.active !== undefined) {
    conditions.push(`active = $${paramIndex++}`);
    params.push(filters.active);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitParam = `$${paramIndex}`;
  params.push(limit);

  const result = await db.query<Plan>(
    `SELECT id, slug, name, description, price_cents, currency, billing_cycle, 
            active, metadata, created_at, updated_at
     FROM subscription.plans 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${limitParam}`,
    params
  );
  return result.rows;
}