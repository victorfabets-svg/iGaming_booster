/**
 * Admin Affiliate Routes — CRUD for affiliate.houses and affiliate.campaigns.
 *
 * The funnel analytics endpoint (GET /admin/affiliate/funnel) lives in
 * affiliate.ts alongside the public click redirect, since they share the
 * houses/campaigns/clicks domain wiring. Both are gated by requireAdmin.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { ok, fail } from '../utils/response';

const SLUG_REGEX = /^[a-z0-9-]+$/;

interface HouseRow {
  id: string;
  slug: string;
  name: string;
  domain: string;
  base_url: string;
  cpa_brl: string;
  revshare_pct: string;
  active: boolean;
  created_at: string;
}

interface HouseCreateBody {
  slug?: string;
  name?: string;
  domain?: string;
  base_url?: string;
  cpa_brl?: number;
  revshare_pct?: number;
  active?: boolean;
}

interface HouseUpdateBody {
  name?: string;
  domain?: string;
  base_url?: string;
  cpa_brl?: number;
  revshare_pct?: number;
  active?: boolean;
}

interface CampaignRow {
  id: string;
  house_id: string;
  house_slug: string;
  slug: string;
  label: string | null;
  created_at: string;
}

interface CampaignCreateBody {
  house_slug?: string;
  slug?: string;
  label?: string;
  owner_user_id?: string;
  redirect_house_slug?: string;
  tagged_house_slugs?: string[];
}

function normalizeHouse(row: HouseRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain,
    base_url: row.base_url,
    cpa_brl: Number(row.cpa_brl),
    revshare_pct: Number(row.revshare_pct),
    active: row.active,
    created_at: row.created_at,
  };
}

function validateHouseCreate(body: HouseCreateBody): string | null {
  if (!body.slug || typeof body.slug !== 'string') return 'slug is required';
  if (!SLUG_REGEX.test(body.slug)) return 'slug must be lowercase alphanumeric with dashes only';
  if (!body.name || typeof body.name !== 'string') return 'name is required';
  if (!body.domain || typeof body.domain !== 'string') return 'domain is required';
  if (!body.base_url || typeof body.base_url !== 'string') return 'base_url is required';
  try {
    new URL(body.base_url);
  } catch {
    return 'base_url must be a valid URL';
  }
  if (body.cpa_brl !== undefined && (isNaN(Number(body.cpa_brl)) || Number(body.cpa_brl) < 0)) {
    return 'cpa_brl must be a non-negative number';
  }
  if (body.revshare_pct !== undefined) {
    const pct = Number(body.revshare_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) return 'revshare_pct must be between 0 and 100';
  }
  return null;
}

function validateHouseUpdate(body: HouseUpdateBody): string | null {
  if (body.base_url !== undefined) {
    if (typeof body.base_url !== 'string') return 'base_url must be a string';
    try {
      new URL(body.base_url);
    } catch {
      return 'base_url must be a valid URL';
    }
  }
  if (body.cpa_brl !== undefined && (isNaN(Number(body.cpa_brl)) || Number(body.cpa_brl) < 0)) {
    return 'cpa_brl must be a non-negative number';
  }
  if (body.revshare_pct !== undefined) {
    const pct = Number(body.revshare_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) return 'revshare_pct must be between 0 and 100';
  }
  return null;
}

export async function adminAffiliateRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /admin/affiliate/houses — list all
  fastify.get(
    '/admin/affiliate/houses',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<HouseRow>(
        `SELECT id, slug, name, domain, base_url, cpa_brl, revshare_pct, active, created_at
           FROM affiliate.houses
           ORDER BY active DESC, slug ASC`
      );
      return ok(reply, { houses: result.rows.map(normalizeHouse) });
    }
  );

  // POST /admin/affiliate/houses — create
  fastify.post<{ Body: HouseCreateBody }>(
    '/admin/affiliate/houses',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest<{ Body: HouseCreateBody }>, reply: FastifyReply) => {
      const body = request.body || {};
      const err = validateHouseCreate(body);
      if (err) return fail(reply, err, 'VALIDATION_ERROR');

      // Uniqueness check on slug
      const existing = await db.query<{ id: string }>(
        `SELECT id FROM affiliate.houses WHERE slug = $1`,
        [body.slug]
      );
      if (existing.rows.length > 0) {
        return fail(reply, `Slug '${body.slug}' already exists`, 'DUPLICATE_SLUG', 409);
      }

      const result = await db.query<HouseRow>(
        `INSERT INTO affiliate.houses (slug, name, domain, base_url, cpa_brl, revshare_pct, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, slug, name, domain, base_url, cpa_brl, revshare_pct, active, created_at`,
        [
          body.slug,
          body.name,
          body.domain,
          body.base_url,
          body.cpa_brl ?? 0,
          body.revshare_pct ?? 0,
          body.active ?? false,
        ]
      );
      return ok(reply, { house: normalizeHouse(result.rows[0]) });
    }
  );

  // PATCH /admin/affiliate/houses/:slug — update mutable fields
  fastify.patch<{ Params: { slug: string }; Body: HouseUpdateBody }>(
    '/admin/affiliate/houses/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: { slug: string }; Body: HouseUpdateBody }>,
      reply: FastifyReply
    ) => {
      const { slug } = request.params;
      const body = request.body || {};
      const err = validateHouseUpdate(body);
      if (err) return fail(reply, err, 'VALIDATION_ERROR');

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const setField = (col: string, val: unknown) => {
        updates.push(`${col} = $${idx++}`);
        values.push(val);
      };

      if (body.name !== undefined) setField('name', body.name);
      if (body.domain !== undefined) setField('domain', body.domain);
      if (body.base_url !== undefined) setField('base_url', body.base_url);
      if (body.cpa_brl !== undefined) setField('cpa_brl', body.cpa_brl);
      if (body.revshare_pct !== undefined) setField('revshare_pct', body.revshare_pct);
      if (body.active !== undefined) setField('active', body.active);

      if (updates.length === 0) {
        return fail(reply, 'No fields to update', 'VALIDATION_ERROR');
      }

      values.push(slug);
      const result = await db.query<HouseRow>(
        `UPDATE affiliate.houses
            SET ${updates.join(', ')}
          WHERE slug = $${idx}
          RETURNING id, slug, name, domain, base_url, cpa_brl, revshare_pct, active, created_at`,
        values
      );

      if (result.rows.length === 0) {
        return fail(reply, `House '${slug}' not found`, 'NOT_FOUND');
      }
      return ok(reply, { house: normalizeHouse(result.rows[0]) });
    }
  );

  // GET /admin/affiliate/campaigns?house=<slug>
  fastify.get<{ Querystring: { house?: string } }>(
    '/admin/affiliate/campaigns',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Querystring: { house?: string } }>,
      reply: FastifyReply
    ) => {
      const houseSlug = request.query.house || null;
      const result = await db.query<CampaignRow>(
        `SELECT c.id, c.house_id, h.slug AS house_slug, c.slug, c.label, c.created_at
           FROM affiliate.campaigns c
           JOIN affiliate.houses h ON h.id = c.house_id
          WHERE $1::text IS NULL OR h.slug = $1
          ORDER BY h.slug, c.slug`,
        [houseSlug]
      );
      return ok(reply, { campaigns: result.rows });
    }
  );

  // POST /admin/affiliate/campaigns - Extended with owner/redirect/tagged support
  fastify.post<{ Body: CampaignCreateBody }>(
    '/admin/affiliate/campaigns',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest<{ Body: CampaignCreateBody }>, reply: FastifyReply) => {
      const body = request.body || {};
      
      // Validate slug required
      if (!body.slug) return fail(reply, 'slug is required', 'VALIDATION_ERROR');
      if (!SLUG_REGEX.test(body.slug)) {
        return fail(reply, 'slug must be lowercase alphanumeric with dashes only', 'VALIDATION_ERROR');
      }

      // Check global slug uniqueness (now enforced by DB)
      const slugCheck = await db.query<{ id: string }>(
        `SELECT id FROM affiliate.campaigns WHERE slug = $1`,
        [body.slug]
      );
      if (slugCheck.rows.length > 0) {
        return fail(reply, `Slug '${body.slug}' already exists`, 'DUPLICATE_SLUG', 409);
      }

      // Validate owner_user_id if provided
      let ownerUserId: string | null = null;
      if (body.owner_user_id) {
        const ownerResult = await db.query<{ id: string; role: string }>(
          `SELECT id, role FROM identity.users WHERE id = $1`,
          [body.owner_user_id]
        );
        if (ownerResult.rows.length === 0) {
          return fail(reply, 'Owner user not found', 'NOT_FOUND');
        }
        if (ownerResult.rows[0].role !== 'affiliate') {
          return fail(reply, 'Owner must have role affiliate', 'INVALID_OWNER', 400);
        }
        ownerUserId = ownerResult.rows[0].id;
      }

      // Resolve redirect_house_id if redirect_house_slug provided
      let redirectHouseId: string | null = null;
      if (body.redirect_house_slug) {
        const houseResult = await db.query<{ id: string }>(
          `SELECT id FROM affiliate.houses WHERE slug = $1`,
          [body.redirect_house_slug]
        );
        if (houseResult.rows.length === 0) {
          return fail(reply, `House '${body.redirect_house_slug}' not found`, 'NOT_FOUND');
        }
        redirectHouseId = houseResult.rows[0].id;
      }

      // Legacy: house_id from house_slug (for backward compat)
      let houseId: string | null = null;
      if (body.house_slug) {
        const houseResult = await db.query<{ id: string }>(
          `SELECT id FROM affiliate.houses WHERE slug = $1`,
          [body.house_slug]
        );
        if (houseResult.rows.length === 0) {
          return fail(reply, `House '${body.house_slug}' not found`, 'NOT_FOUND');
        }
        houseId = houseResult.rows[0].id;
      }

      // Resolve tagged house slugs
      const taggedHouseIds: string[] = [];
      if (body.tagged_house_slugs && body.tagged_house_slugs.length > 0) {
        for (const tagSlug of body.tagged_house_slugs) {
          const houseResult = await db.query<{ id: string }>(
            `SELECT id FROM affiliate.houses WHERE slug = $1`,
            [tagSlug]
          );
          if (houseResult.rows.length > 0) {
            taggedHouseIds.push(houseResult.rows[0].id);
          }
        }
      }

      // Insert campaign in transaction
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        // Insert campaign - legacy house_id kept NULL even when redirect_house_id present
        const campaignResult = await client.query<{
          id: string;
          house_id: string;
          house_slug: string;
          slug: string;
          label: string | null;
          owner_user_id: string | null;
          redirect_house_id: string | null;
          created_at: string;
        }>(
          `INSERT INTO affiliate.campaigns (house_id, slug, label, owner_user_id, redirect_house_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, house_id, slug, label, owner_user_id, redirect_house_id, created_at`,
          [houseId, body.slug, body.label ?? null, ownerUserId, redirectHouseId]
        );

        const campaign = campaignResult.rows[0];

        // Insert tagged houses
        if (taggedHouseIds.length > 0) {
          for (const taggedHouseId of taggedHouseIds) {
            await client.query(
              `INSERT INTO affiliate.campaign_houses (campaign_id, house_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [campaign.id, taggedHouseId]
            );
          }
        }

        await client.query('COMMIT');

        // Get house slug for redirect
        let redirectHouseSlug: string | null = null;
        if (campaign.redirect_house_id) {
          const rhResult = await db.query<{ slug: string }>(
            `SELECT slug FROM affiliate.houses WHERE id = $1`,
            [campaign.redirect_house_id]
          );
          redirectHouseSlug = rhResult.rows[0]?.slug ?? null;
        }

        return ok(reply, {
          campaign: {
            id: campaign.id,
            slug: campaign.slug,
            label: campaign.label,
            owner_user_id: campaign.owner_user_id,
            redirect_house_id: campaign.redirect_house_id,
            redirect_house_slug: redirectHouseSlug,
            tagged_house_ids: taggedHouseIds,
          }
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[admin-affiliate] campaign insert failed:', err);
        return fail(reply, 'Failed to create campaign', 'INTERNAL_ERROR');
      } finally {
        client.release();
      }
    }
  );
}
