/**
 * Affiliate Routes for /affiliate/me/* endpoints
 * 
 * Provides campaign management and funnel analytics for affiliates.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAffiliateOrAdmin } from '../../infrastructure/auth/require-affiliate';
import { ok, fail } from '../utils/response';

interface FunnelQuery {
  from?: string;
  to?: string;
}

interface JwtPayload {
  sub: string;
  user_id: string;
  role?: string;
}

/**
 * Affiliate "me" routes
 */
export async function affiliateMeRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /affiliate/me/campaigns - List campaigns owned by current user
  fastify.get(
    '/affiliate/me/campaigns',
    { preHandler: [authMiddleware, requireAffiliateOrAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const decoded = (request as any).user as JwtPayload | undefined;
      const userId = decoded?.user_id || decoded?.sub;

      if (!userId) {
        return fail(reply, 'Unable to identify current user', 'INTERNAL_ERROR');
      }

      const result = await db.query<{
        id: string;
        slug: string;
        label: string | null;
        redirect_house_id: string | null;
        created_at: string;
      }>(
        `SELECT c.id, c.slug, c.label, c.redirect_house_id, c.created_at
         FROM affiliate.campaigns c
         WHERE c.owner_user_id = $1
         ORDER BY c.created_at DESC`,
        [userId]
      );

      // Get redirect house slugs and tagged house slugs
      const campaigns = await Promise.all(result.rows.map(async (campaign) => {
        // Get redirect house slug
        let redirectHouseSlug: string | null = null;
        if (campaign.redirect_house_id) {
          const rhResult = await db.query<{ slug: string }>(
            `SELECT slug FROM affiliate.houses WHERE id = $1`,
            [campaign.redirect_house_id]
          );
          redirectHouseSlug = rhResult.rows[0]?.slug ?? null;
        }

        // Get tagged house slugs
        const taggedResult = await db.query<{ slug: string }>(
          `SELECT h.slug FROM affiliate.campaign_houses ch
           JOIN affiliate.houses h ON h.id = ch.house_id
           WHERE ch.campaign_id = $1`,
          [campaign.id]
        );
        const taggedHouseSlugs = taggedResult.rows.map(r => r.slug);

        return {
          id: campaign.id,
          slug: campaign.slug,
          label: campaign.label,
          redirect_house_slug: redirectHouseSlug,
          tagged_house_slugs: taggedHouseSlugs,
          created_at: campaign.created_at,
        };
      }));

      return ok(reply, { campaigns });
    }
  );

  // GET /affiliate/me/funnel - Funnel analytics for current user's campaigns
  fastify.get<{ Querystring: FunnelQuery }>(
    '/affiliate/me/funnel',
    { preHandler: [authMiddleware, requireAffiliateOrAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Querystring: FunnelQuery }>,
      reply: FastifyReply
    ) => {
      const decoded = (request as any).user as JwtPayload | undefined;
      const userId = decoded?.user_id || decoded?.sub;

      if (!userId) {
        return fail(reply, 'Unable to identify current user', 'INTERNAL_ERROR');
      }

      const { from, to } = request.query;

      // Parse and validate date range
      const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      // Validate dates
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return fail(reply, 'Invalid date format. Use ISO 8601 (YYYY-MM-DD or full ISO).', 'VALIDATION_ERROR');
      }
      if (fromDate >= toDate) {
        return fail(reply, '`from` must be earlier than `to`', 'VALIDATION_ERROR');
      }

      const fromStr = fromDate.toISOString();
      const toStr = toDate.toISOString();

      // Funnel query - scoped to owner's campaigns, all attribution lifetime
      const funnelQuery = `
        WITH range AS (
          SELECT
            $1::timestamp AS from_ts,
            $2::timestamp AS to_ts
        ),
        my_campaigns AS (
          SELECT id FROM affiliate.campaigns WHERE owner_user_id = $3
        )
        SELECT
          COUNT(DISTINCT c.click_id) AS clicks,
          COUNT(DISTINCT a.user_id) AS registers,
          COUNT(DISTINCT p.id) FILTER (WHERE p.user_id IS NOT NULL) AS first_proof,
          COUNT(DISTINCT pv.proof_id) FILTER (WHERE pv.status = 'approved') AS approved
        FROM my_campaigns mc
        LEFT JOIN affiliate.clicks c
          ON c.campaign_id = mc.id
          AND c.created_at >= (SELECT from_ts FROM range)
          AND c.created_at <  (SELECT to_ts FROM range)
        LEFT JOIN affiliate.attributions a
          ON a.click_id = c.click_id
        LEFT JOIN validation.proofs p
          ON p.user_id = a.user_id
        LEFT JOIN validation.proof_validations pv
          ON pv.proof_id = p.id
      `;

      try {
        const result = await db.query<{
          clicks: string;
          registers: string;
          first_proof: string;
          approved: string;
        }>(funnelQuery, [fromStr, toStr, userId]);

        const row = result.rows[0];
        const totals = {
          clicks: parseInt(row.clicks) || 0,
          registers: parseInt(row.registers) || 0,
          first_proof: parseInt(row.first_proof) || 0,
          approved: parseInt(row.approved) || 0,
        };

        return ok(reply, { totals, range: { from: fromStr, to: toStr } });
      } catch (err) {
        console.error('[affiliate-me] funnel query failed:', err);
        return fail(reply, 'Failed to load funnel data');
      }
    }
  );
}