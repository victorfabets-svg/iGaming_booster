/**
 * Admin Routes for Promotions Management
 * 
 * CRUD for promotions, tiers, and repescagem functionality
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { ok, fail } from '../utils/response';
import { db } from '@shared/database/connection';

// Input validation constants
const SLUG_REGEX = /^[a-z0-9-]+$/;

interface PromotionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  house_id: string;
  house_slug: string;
  house_name: string;
  raffle_id: string;
  starts_at: Date;
  ends_at: Date;
  draw_at: Date;
  repescagem: boolean;
  repescagem_applied_at: Date | null;
  active: boolean;
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
}

interface PromotionTierRow {
  min_deposit_cents: number;
  tickets: number;
}

interface RaffleRow {
  id: string;
  name: string;
  prize: string;
  draw_date: Date;
  status: string;
}

/**
 * Validate promotion input.
 */
function validatePromotionInput(input: unknown, isUpdate = false): string | null {
  if (!input || typeof input !== 'object') {
    return 'Invalid request body';
  }

  const body = input as Record<string, unknown>;

  // Required fields (only for create)
  if (!isUpdate) {
    if (typeof body.slug !== 'string' || !body.slug) {
      return 'slug is required';
    }
    if (typeof body.name !== 'string' || !body.name) {
      return 'name is required';
    }
    if (typeof body.house_slug !== 'string' || !body.house_slug) {
      return 'house_slug is required';
    }
    if (typeof body.raffle_id !== 'string' || !body.raffle_id) {
      return 'raffle_id is required';
    }
    if (typeof body.starts_at !== 'string' || !body.starts_at) {
      return 'starts_at is required';
    }
    if (typeof body.ends_at !== 'string' || !body.ends_at) {
      return 'ends_at is required';
    }
    if (typeof body.draw_at !== 'string' || !body.draw_at) {
      return 'draw_at is required';
    }
    if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
      return 'tiers is required and must have at least 1 entry';
    }
  }

  // Validate slug format (only for create)
  if (!isUpdate && body.slug && !SLUG_REGEX.test(body.slug as string)) {
    return 'slug must be lowercase alphanumeric with dashes only';
  }

  // Validate dates
  if (body.starts_at) {
    const startsAt = new Date(body.starts_at as string);
    if (isNaN(startsAt.getTime())) {
      return 'starts_at must be a valid ISO timestamp';
    }
  }
  if (body.ends_at) {
    const endsAt = new Date(body.ends_at as string);
    if (isNaN(endsAt.getTime())) {
      return 'ends_at must be a valid ISO timestamp';
    }
    if (body.starts_at) {
      const startsAt = new Date(body.starts_at as string);
      if (endsAt < startsAt) {
        return 'ends_at must be >= starts_at';
      }
    }
  }
  if (body.draw_at) {
    const drawAt = new Date(body.draw_at as string);
    if (isNaN(drawAt.getTime())) {
      return 'draw_at must be a valid ISO timestamp';
    }
    if (body.ends_at) {
      const endsAt = new Date(body.ends_at as string);
      if (drawAt < endsAt) {
        return 'draw_at must be >= ends_at';
      }
    }
  }

  // Validate tiers
  if (body.tiers && Array.isArray(body.tiers)) {
    const seenMins = new Set<number>();
    for (const tier of body.tiers) {
      if (!tier || typeof tier !== 'object') {
        return 'each tier must be an object';
      }
      const t = tier as { min_deposit_cents?: number; tickets?: number };
      if (typeof t.min_deposit_cents !== 'number' || t.min_deposit_cents < 0) {
        return 'tier min_deposit_cents must be >= 0';
      }
      if (typeof t.tickets !== 'number' || t.tickets < 1) {
        return 'tier tickets must be >= 1';
      }
      if (seenMins.has(t.min_deposit_cents)) {
        return 'duplicate min_deposit_cents in tiers';
      }
      seenMins.add(t.min_deposit_cents);
    }
  }

  // Validate repescagem_source_slugs
  if (body.repescagem_source_slugs && Array.isArray(body.repescagem_source_slugs)) {
    for (const s of body.repescagem_source_slugs) {
      if (typeof s !== 'string') {
        return 'each repescagem_source_slugs must be a string';
      }
    }
  }

  return null;
}

/**
 * GET /admin/raffles - List all raffles (for selection)
 */
async function listRaffles(filters?: { active?: boolean; without_promotion?: boolean }): Promise<RaffleRow[]> {
  let sql = `SELECT r.id, r.name, r.prize, r.draw_date, r.status FROM raffles.raffles r`;
  const params: unknown[] = [];
  let where = '';

  if (filters?.without_promotion) {
    sql = `SELECT r.id, r.name, r.prize, r.draw_date, r.status
            FROM raffles.raffles r
            WHERE NOT EXISTS (
              SELECT 1 FROM promotions.promotions p WHERE p.raffle_id = r.id
            )`;
  }

  if (filters?.active !== undefined) {
    where = params.length === 0 ? ' WHERE r.active = $1' : ' AND r.active = $1';
    params.push(filters.active);
  }

  const result = await db.query(sql + (where ? where : ''), params);
  return result.rows as RaffleRow[];
}

/**
 * GET /admin/promotions - List all promotions
 */
async function listPromotions(filters?: { house?: string; active?: boolean }): Promise<PromotionRow[]> {
  let sql = `SELECT p.id, p.slug, p.name, p.description, p.creative_url,
                    p.house_id, h.slug as house_slug, h.name as house_name,
                    p.raffle_id, p.starts_at, p.ends_at, p.draw_at,
                    p.repescagem, p.repescagem_applied_at, p.active, p.is_featured,
                    p.created_at, p.updated_at
               FROM promotions.promotions p
               JOIN core.houses h ON h.id = p.house_id`;
  const params: unknown[] = [];
  let where: string[] = [];

  if (filters?.house) {
    where.push(`h.slug = $${params.length + 1}`);
    params.push(filters.house);
  }
  if (filters?.active !== undefined) {
    where.push(`p.active = $${params.length + 1}`);
    params.push(filters.active);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY p.created_at DESC';

  const result = await db.query(sql, params);
  return result.rows as PromotionRow[];
}

/**
 * GET /admin/promotions/:slug - Get a single promotion with tiers
 */
async function getPromotionBySlug(slug: string): Promise<{
  promotion: PromotionRow;
  tiers: PromotionTierRow[];
  repescagem_source_slugs: string[];
} | null> {
  const promoResult = await db.query(
    `SELECT p.id, p.slug, p.name, p.description, p.creative_url,
            p.house_id, h.slug as house_slug, h.name as house_name,
            p.raffle_id, p.starts_at, p.ends_at, p.draw_at,
            p.repescagem, p.repescagem_applied_at, p.active, p.is_featured,
            p.created_at, p.updated_at
       FROM promotions.promotions p
       JOIN core.houses h ON h.id = p.house_id
      WHERE p.slug = $1`,
    [slug]
  );

  if (promoResult.rows.length === 0) {
    return null;
  }

  const promotion = promoResult.rows[0] as PromotionRow;

  // Get tiers
  const tiersResult = await db.query(
    `SELECT min_deposit_cents, tickets
       FROM promotions.tiers
      WHERE promotion_id = $1
      ORDER BY min_deposit_cents DESC`,
    [promotion.id]
  );
  const tiers = tiersResult.rows as PromotionTierRow[];

  // Get repescagem sources
  const sourcesResult = await db.query(
    `SELECT rs.source_promotion_id, p.slug as source_slug
       FROM promotions.repescagem_sources rs
       JOIN promotions.promotions p ON p.id = rs.source_promotion_id
      WHERE rs.promotion_id = $1`,
    [promotion.id]
  );
  const repescagem_source_slugs = sourcesResult.rows.map(r => r.source_slug);

  return { promotion, tiers, repescagem_source_slugs };
}

/**
 * GET promotion by ID
 */
async function getPromotionById(id: string): Promise<{
  promotion: PromotionRow;
  tiers: PromotionTierRow[];
  repescagem_source_slugs: string[];
} | null> {
  const result = await db.query(
    `SELECT p.id, p.slug, p.name, p.description, p.creative_url,
            p.house_id, h.slug as house_slug, h.name as house_name,
            p.raffle_id, p.starts_at, p.ends_at, p.draw_at,
            p.repescagem, p.repescagem_applied_at, p.active, p.is_featured,
            p.created_at, p.updated_at
       FROM promotions.promotions p
       JOIN core.houses h ON h.id = p.house_id
      WHERE p.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const promotion = result.rows[0] as PromotionRow;

  const tiersResult = await db.query(
    `SELECT min_deposit_cents, tickets FROM promotions.tiers WHERE promotion_id = $1 ORDER BY min_deposit_cents DESC`,
    [promotion.id]
  );
  const tiers = tiersResult.rows as PromotionTierRow[];

  const sourcesResult = await db.query(
    `SELECT rs.source_promotion_id, p.slug as source_slug
       FROM promotions.repescagem_sources rs
       JOIN promotions.promotions p ON p.id = rs.source_promotion_id
      WHERE rs.promotion_id = $1`,
    [promotion.id]
  );
  const repescagem_source_slugs = sourcesResult.rows.map(r => r.source_slug);

  return { promotion, tiers, repescagem_source_slugs };
}

/**
 * CREATE a promotion with tiers and sources (in transaction)
 */
async function createPromotion(input: {
  slug: string;
  name: string;
  description?: string;
  creative_url?: string;
  house_slug: string;
  raffle_id: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  tiers: { min_deposit_cents: number; tickets: number }[];
  repescagem_source_slugs?: string[];
  active?: boolean;
}): Promise<{ id: string }> {
  // Resolve house_slug to house_id
  const houseResult = await db.query(`SELECT id FROM core.houses WHERE slug = $1`, [input.house_slug]);
  if (houseResult.rows.length === 0) {
    throw new Error('NOT_FOUND');
  }
  const house_id = houseResult.rows[0].id;

  // Validate raffle exists
  const raffleResult = await db.query(`SELECT id FROM raffles.raffles WHERE id = $1`, [input.raffle_id]);
  if (raffleResult.rows.length === 0) {
    throw new Error('RAFFLE_NOT_FOUND');
  }

  // Resolve source slugs to promotion IDs
  const sourceIds: string[] = [];
  if (input.repescagem_source_slugs && input.repescagem_source_slugs.length > 0) {
    for (const s of input.repescagem_source_slugs) {
      const srcResult = await db.query(`SELECT id FROM promotions.promotions WHERE slug = $1`, [s]);
      if (srcResult.rows.length === 0) {
        throw new Error('SOURCE_NOT_FOUND');
      }
      sourceIds.push(srcResult.rows[0].id);
    }
  }

  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(input.ends_at);
  const drawAt = new Date(input.draw_at);
  const hasRepescagem = sourceIds.length > 0;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert promotion
    const promoResult = await client.query(
      `INSERT INTO promotions.promotions (slug, name, description, creative_url, house_id, raffle_id, starts_at, ends_at, draw_at, repescagem, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        input.slug,
        input.name,
        input.description || null,
        input.creative_url || null,
        house_id,
        input.raffle_id,
        startsAt,
        endsAt,
        drawAt,
        hasRepescagem,
        input.active ?? true,
      ]
    );
    const promotionId = promoResult.rows[0].id;

    // Insert tiers
    for (const tier of input.tiers) {
      await client.query(
        `INSERT INTO promotions.tiers (promotion_id, min_deposit_cents, tickets)
         VALUES ($1, $2, $3)`,
        [promotionId, tier.min_deposit_cents, tier.tickets]
      );
    }

    // Insert repescagem sources
    for (const sourceId of sourceIds) {
      await client.query(
        `INSERT INTO promotions.repescagem_sources (promotion_id, source_promotion_id)
         VALUES ($1, $2)`,
        [promotionId, sourceId]
      );
    }

    await client.query('COMMIT');
    return { id: promotionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * UPDATE a promotion
 */
async function updatePromotion(slug: string, input: {
  name?: string;
  description?: string;
  creative_url?: string;
  ends_at?: string;
  draw_at?: string;
  active?: boolean;
  tiers?: { min_deposit_cents: number; tickets: number }[];
  repescagem_source_slugs?: string[];
}): Promise<{
  promotion: PromotionRow;
  tiers: PromotionTierRow[];
  repescagem_source_slugs: string[];
} | null> {
  // Get current promotion
  const current = await getPromotionBySlug(slug);
  if (!current) {
    return null;
  }

  const promotionId = current.promotion.id;
  const isRepescagemApplied = current.promotion.repescagem_applied_at !== null;

  // Check if trying to modify locked fields when repescagem is applied
  if ((input.tiers || input.repescagem_source_slugs) && isRepescagemApplied) {
    throw new Error('REPESCAGEM_LOCKED');
  }

  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [promotionId];
  let paramIndex = 2;

  if (input.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }
  if (input.description !== undefined) {
    sets.push(`description = $${paramIndex++}`);
    params.push(input.description || null);
  }
  if (input.creative_url !== undefined) {
    sets.push(`creative_url = $${paramIndex++}`);
    params.push(input.creative_url || null);
  }
  if (input.ends_at !== undefined) {
    sets.push(`ends_at = $${paramIndex++}`);
    params.push(new Date(input.ends_at));
  }
  if (input.draw_at !== undefined) {
    sets.push(`draw_at = $${paramIndex++}`);
    params.push(new Date(input.draw_at));
  }
  if (input.active !== undefined) {
    sets.push(`active = $${paramIndex++}`);
    params.push(input.active);
  }

  // Handle tiers update
  let tiersUpdated = false;
  if (input.tiers !== undefined) {
    const seenMins = new Set<number>();
    for (const t of input.tiers) {
      if (seenMins.has(t.min_deposit_cents)) {
        throw new Error('VALIDATION_ERROR');
      }
      seenMins.add(t.min_deposit_cents);
    }
    tiersUpdated = true;
  }

  // Handle repescagem sources update
  let sourcesUpdated = false;
  if (input.repescagem_source_slugs !== undefined) {
    sourcesUpdated = true;
  }

  if (tiersUpdated || sourcesUpdated || sets.length > 1) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Update promotion basic fields
      if (sets.length > 1) {
        await client.query(
          `UPDATE promotions.promotions SET ${sets.join(', ')} WHERE id = $1`,
          params
        );
      }

      // Update tiers if provided
      if (tiersUpdated) {
        await client.query(`DELETE FROM promotions.tiers WHERE promotion_id = $1`, [promotionId]);
        for (const tier of input.tiers!) {
          await client.query(
            `INSERT INTO promotions.tiers (promotion_id, min_deposit_cents, tickets)
             VALUES ($1, $2, $3)`,
            [promotionId, tier.min_deposit_cents, tier.tickets]
          );
        }
      }

      // Update repescagem sources if provided
      if (sourcesUpdated) {
        await client.query(`DELETE FROM promotions.repescagem_sources WHERE promotion_id = $1`, [promotionId]);
        if (input.repescagem_source_slugs!.length > 0) {
          const newRepescagem = input.repescagem_source_slugs!.length > 0;
          await client.query(`UPDATE promotions.promotions SET repescagem = $1, updated_at = NOW() WHERE id = $2`, [newRepescagem, promotionId]);

          for (const s of input.repescagem_source_slugs!) {
            const srcResult = await client.query(`SELECT id FROM promotions.promotions WHERE slug = $1`, [s]);
            if (srcResult.rows.length > 0) {
              await client.query(
                `INSERT INTO promotions.repescagem_sources (promotion_id, source_promotion_id)
                 VALUES ($1, $2)`,
                [promotionId, srcResult.rows[0].id]
              );
            }
          }
        }
      }

      await client.query('COMMIT');
      return getPromotionById(promotionId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return getPromotionById(promotionId);
}

/**
 * APPLY repescagem for a promotion
 */
async function applyRepescagem(slug: string): Promise<{ invitations_created: number; applied_at: Date }> {
  // Get promotion
  const current = await getPromotionBySlug(slug);
  if (!current) {
    throw new Error('NOT_FOUND');
  }

  const promotion = current.promotion;

  // Check preconditions
  if (!promotion.repescagem) {
    throw new Error('REPESCAGEM_DISABLED');
  }
  if (promotion.repescagem_applied_at) {
    throw new Error('ALREADY_APPLIED');
  }

  // Check that there are sources
  const sourcesResult = await db.query(
    `SELECT source_promotion_id FROM promotions.repescagem_sources WHERE promotion_id = $1`,
    [promotion.id]
  );
  if (sourcesResult.rows.length === 0) {
    throw new Error('NO_SOURCES');
  }

  const sourceIds = sourcesResult.rows.map(r => r.source_promotion_id);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Find losing tickets from source promotions (tickets where raffle has been drawn and user didn't win)
    const losingUsersResult = await client.query(
      `SELECT DISTINCT t.user_id, src.id AS source_promotion_id
         FROM raffles.tickets t
         JOIN raffles.raffles r ON r.id = t.raffle_id
         JOIN raffles.raffle_draws rd ON rd.raffle_id = r.id
         JOIN promotions.promotions src ON src.raffle_id = r.id
         JOIN promotions.repescagem_sources rs ON rs.source_promotion_id = src.id
        WHERE rs.promotion_id = $1
          AND t.id <> rd.winner_ticket_id`,
      [promotion.id]
    );

    const userIds = losingUsersResult.rows.map(r => r.user_id);
    let invitationsCreated = 0;

    // Insert invitations for each user
    for (const userId of userIds) {
      // Find which source promotion they participated in
      const sourceResult = await client.query(
        `SELECT DISTINCT src.id as source_promotion_id
           FROM raffles.tickets t
           JOIN raffles.raffles r ON r.id = t.raffle_id
           JOIN raffles.raffle_draws rd ON rd.raffle_id = r.id
           JOIN promotions.promotions src ON src.raffle_id = r.id
           JOIN promotions.repescagem_sources rs ON rs.source_promotion_id = src.id
          WHERE rs.promotion_id = $1 AND t.user_id = $2 AND t.id <> rd.winner_ticket_id`,
        [promotion.id, userId]
      );

      const sourcePromoId = sourceResult.rows[0]?.source_promotion_id || sourceIds[0];

      await client.query(
        `INSERT INTO promotions.repescagem_invitations (promotion_id, user_id, source_promotion_id, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (promotion_id, user_id) DO NOTHING`,
        [promotion.id, userId, sourcePromoId]
      );
      invitationsCreated++;
    }

    // Update promotion with applied timestamp
    const appliedResult = await client.query(
      `UPDATE promotions.promotions SET repescagem_applied_at = NOW() WHERE id = $1
       RETURNING repescagem_applied_at`,
      [promotion.id]
    );

    await client.query('COMMIT');
    return {
      invitations_created: invitationsCreated,
      applied_at: appliedResult.rows[0].repescagem_applied_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function adminPromotionsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /admin/raffles - List all raffles (for selection)
  fastify.get(
    '/admin/raffles',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { active?: string; without_promotion?: string };
      const filters: { active?: boolean; without_promotion?: boolean } = {};
      if (query.active !== undefined) {
        filters.active = query.active === 'true';
      }
      if (query.without_promotion !== undefined) {
        filters.without_promotion = query.without_promotion === 'true';
      }
      const raffles = await listRaffles(filters);
      return ok(reply, { raffles });
    }
  );

  // GET /admin/promotions - List all promotions
  fastify.get(
    '/admin/promotions',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { house?: string; active?: string };
      const filters: { house?: string; active?: boolean } = {};
      if (query.house) {
        filters.house = query.house;
      }
      if (query.active !== undefined) {
        filters.active = query.active === 'true';
      }
      const promotions = await listPromotions(filters);

      // Enrich with tiers and sources
      const enrichedPromotions = await Promise.all(
        promotions.map(async (p) => {
          const detail = await getPromotionById(p.id);
          return {
            ...p,
            tiers: detail?.tiers || [],
            repescagem_source_slugs: detail?.repescagem_source_slugs || [],
          };
        })
      );

      return ok(reply, { promotions: enrichedPromotions });
    }
  );

  // GET /admin/promotions/:slug - Get a single promotion
  fastify.get(
    '/admin/promotions/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { slug: string };
      const promotion = await getPromotionBySlug(params.slug);
      if (!promotion) {
        return fail(reply, 'Promotion not found', 'NOT_FOUND');
      }
      return ok(reply, { promotion: promotion.promotion, tiers: promotion.tiers, repescagem_source_slugs: promotion.repescagem_source_slugs });
    }
  );

  // POST /admin/promotions - Create a promotion
  fastify.post(
    '/admin/promotions',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validationError = validatePromotionInput(request.body);
      if (validationError) {
        return fail(reply, validationError, 'VALIDATION_ERROR');
      }

      const input = request.body as {
        slug: string;
        name: string;
        description?: string;
        creative_url?: string;
        house_slug: string;
        raffle_id: string;
        starts_at: string;
        ends_at: string;
        draw_at: string;
        tiers: { min_deposit_cents: number; tickets: number }[];
        repescagem_source_slugs?: string[];
        active?: boolean;
      };
      const startsAt = new Date(input.starts_at);
      const endsAt = new Date(input.ends_at);
      const drawAt = new Date(input.draw_at);

      // Validate date constraints
      if (endsAt < startsAt) {
        return fail(reply, 'ends_at must be >= starts_at', 'VALIDATION_ERROR');
      }
      if (drawAt < endsAt) {
        return fail(reply, 'draw_at must be >= ends_at', 'VALIDATION_ERROR');
      }

      if (input.tiers.length === 0) {
        return fail(reply, 'At least 1 tier is required', 'VALIDATION_ERROR');
      }

      try {
        const result = await createPromotion(input);
        const promotion = await getPromotionById(result.id);
        return ok(reply, { promotion: promotion?.promotion, tiers: promotion?.tiers, repescagem_source_slugs: promotion?.repescagem_source_slugs });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg === 'NOT_FOUND') return fail(reply, 'House not found', 'NOT_FOUND');
        if (msg === 'RAFFLE_NOT_FOUND') return fail(reply, 'Raffle not found', 'NOT_FOUND');
        if (msg === 'SOURCE_NOT_FOUND') return fail(reply, 'Source promotion not found', 'NOT_FOUND');
        return fail(reply, msg, 'CREATE_ERROR');
      }
    }
  );

  // PATCH /admin/promotions/:slug - Update a promotion
  fastify.patch(
    '/admin/promotions/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { slug: string };
      const body = request.body as {
        name?: string;
        description?: string;
        creative_url?: string;
        ends_at?: string;
        draw_at?: string;
        active?: boolean;
        tiers?: { min_deposit_cents: number; tickets: number }[];
        repescagem_source_slugs?: string[];
      };

      const validationError = validatePromotionInput(request.body, true);
      if (validationError) {
        return fail(reply, validationError, 'VALIDATION_ERROR');
      }

      try {
        const result = await updatePromotion(params.slug, body);
        if (!result) {
          return fail(reply, 'Promotion not found', 'NOT_FOUND');
        }
        return ok(reply, { promotion: result.promotion, tiers: result.tiers, repescagem_source_slugs: result.repescagem_source_slugs });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg === 'REPESCAGEM_LOCKED') {
          return fail(reply, 'Promoção já teve repescagem aplicada — tiers e sources são imutáveis.', 'REPESCAGEM_LOCKED');
        }
        if (msg === 'VALIDATION_ERROR') {
          return fail(reply, 'Duplicate min_deposit_cents in tiers', 'VALIDATION_ERROR');
        }
        return fail(reply, msg, 'UPDATE_ERROR');
      }
    }
  );

  // POST /admin/promotions/:slug/feature - Mark this promotion as featured on
  // the public landing. At most one featured at any time (DB partial UNIQUE).
  // Body: { featured: boolean }. featured=true clears the previous featured
  // and sets this one in a transaction; featured=false just clears this one.
  fastify.post(
    '/admin/promotions/:slug/feature',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { slug: string };
      const body = request.body as { featured?: boolean };

      if (typeof body.featured !== 'boolean') {
        return fail(reply, 'featured must be a boolean', 'VALIDATION_ERROR');
      }

      // Confirm the promotion exists.
      const exists = await db.query<{ id: string }>(
        `SELECT id FROM promotions.promotions WHERE slug = $1`,
        [params.slug]
      );
      if (exists.rows.length === 0) {
        return fail(reply, 'Promotion not found', 'NOT_FOUND');
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        if (body.featured) {
          // Clear any existing featured first to satisfy the partial UNIQUE.
          await client.query(
            `UPDATE promotions.promotions
                SET is_featured = FALSE, updated_at = NOW()
              WHERE is_featured = TRUE AND slug <> $1`,
            [params.slug]
          );
          await client.query(
            `UPDATE promotions.promotions
                SET is_featured = TRUE, updated_at = NOW()
              WHERE slug = $1`,
            [params.slug]
          );
        } else {
          await client.query(
            `UPDATE promotions.promotions
                SET is_featured = FALSE, updated_at = NOW()
              WHERE slug = $1`,
            [params.slug]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return fail(reply, msg, 'FEATURE_ERROR');
      } finally {
        client.release();
      }

      const result = await getPromotionBySlug(params.slug);
      if (!result) {
        return fail(reply, 'Promotion not found', 'NOT_FOUND');
      }
      return ok(reply, {
        promotion: result.promotion,
        tiers: result.tiers,
        repescagem_source_slugs: result.repescagem_source_slugs,
      });
    }
  );

  // POST /admin/promotions/:slug/apply-repescagem - Apply repescagem
  fastify.post(
    '/admin/promotions/:slug/apply-repescagem',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { slug: string };
      const body = request.body as { confirm?: boolean };

      if (body.confirm !== true) {
        return fail(reply, 'INVALID_CONFIRM', 'INVALID_CONFIRM');
      }

      try {
        const result = await applyRepescagem(params.slug);
        return ok(reply, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg === 'NOT_FOUND') return fail(reply, 'Promotion not found', 'NOT_FOUND');
        if (msg === 'REPESCAGEM_DISABLED') return fail(reply, 'Repescagem disabled for this promotion', 'REPESCAGEM_DISABLED');
        if (msg === 'ALREADY_APPLIED') return fail(reply, 'Repescagem already applied', 'ALREADY_APPLIED');
        if (msg === 'NO_SOURCES') return fail(reply, 'No repescagem sources configured', 'NO_SOURCES');
        return fail(reply, msg, 'REPESCAGEM_ERROR');
      }
    }
  );
}