import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { randomUUID } from 'crypto';
import { ok, fail } from '../utils/response';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { auditLog } from '@shared/events/audit-log';

interface ClickParams {
  house_slug: string;
  campaign_slug?: string;
}

interface FunnelQuery {
  house?: string;
  from?: string;
  to?: string;
}

/**
 * Affiliate routes - click tracking, attribution, and funnel analytics
 */
export async function affiliateRoutes(fastify: FastifyInstance): Promise<void> {
  // Affiliate redirect: /r/:house_slug/:campaign_slug?
  // Registers click, sets cookie, redirects to house base URL
  fastify.get<{ Params: ClickParams }>(
    '/r/:house_slug/:campaign_slug?',
    async (request: FastifyRequest<{ Params: ClickParams }>, reply: FastifyReply) => {
      const { house_slug, campaign_slug } = request.params;

      // Get client info - align with auth.ts pattern (request.ip first)
      const ip = request.ip
        || (request.headers['x-forwarded-for'] as string)
        || 'unknown';
      const userAgent = request.headers['user-agent'];
      const country = request.headers['cf-ipcountry'] as string
        || request.headers['x-vercel-ip-country'] as string
        || null;

      // UTM params
      const utmSource = request.query['utm_source'] as string | undefined;
      const utmMedium = request.query['utm_medium'] as string | undefined;
      const utmCampaign = request.query['utm_campaign'] as string | undefined;
      const utmTerm = request.query['utm_term'] as string | undefined;
      const utmContent = request.query['utm_content'] as string | undefined;

      // Lookup active house
      const houseResult = await db.query<{ id: string; slug: string; name: string; base_url: string }>(
        `SELECT id, slug, name, base_url FROM affiliate.houses WHERE slug = $1 AND active = true`,
        [house_slug]
      );

      const house = houseResult.rows[0];
      if (!house) {
        return reply.status(404).send({ success: false, error: 'House not found or inactive', code: 'NOT_FOUND' });
      }

      // Lookup campaign (optional, non-blocking)
      let campaignId = null;
      if (campaign_slug) {
        const campaignResult = await db.query<{ id: string }>(
          `SELECT id FROM affiliate.campaigns WHERE house_id = $1 AND slug = $2`,
          [house.id, campaign_slug]
        );
        campaignId = campaignResult.rows[0]?.id || null;
      }

      const clickId = randomUUID();

      // Best-effort click recording
      try {
        await db.query(
          `INSERT INTO affiliate.clicks (
            house_id, campaign_id, click_id, ip, user_agent, ref_cookie,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content, country
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [house.id, campaignId, clickId, ip, userAgent, null, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, country]
        );
      } catch (err) {
        // Log error but don't block the redirect
        console.error('[affiliate] click insert failed:', err);
      }

      // Set cookie for attribution
      const isProduction = process.env.NODE_ENV === 'production';
      reply.setCookie('tipster_cid', clickId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 90 * 24 * 60 * 60, // 90 days
      });

      // Build destination URL with UTM params
      const url = new URL(house.base_url);
      if (utmSource) url.searchParams.set('utm_source', utmSource);
      if (utmMedium) url.searchParams.set('utm_medium', utmMedium);
      if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign);
      if (utmTerm) url.searchParams.set('utm_term', utmTerm);
      if (utmContent) url.searchParams.set('utm_content', utmContent);

      return reply.status(302).header('Location', url.toString()).send();
    }
  );

  // Admin funnel analytics: /admin/affiliate/funnel
  fastify.get<{ Querystring: FunnelQuery }>(
    '/admin/affiliate/funnel',
    {
      preHandler: [authMiddleware, requireAdmin(fastify)],
    },
    async (request: FastifyRequest<{ Querystring: FunnelQuery }>, reply: FastifyReply) => {
      const { house: houseSlug, from, to } = request.query;

      // Parse and validate date range
      const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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

      // Funnel query - window applied only to clicks; downstream counted at any time
      const funnelQuery = `
        WITH range AS (
          SELECT
            $1::timestamp AS from_ts,
            $2::timestamp AS to_ts,
            $3::text       AS house_slug
        ),
        h AS (
          SELECT id, slug, name FROM affiliate.houses
          WHERE (SELECT house_slug FROM range) IS NULL
             OR slug = (SELECT house_slug FROM range)
        )
        SELECT
          h.slug,
          h.name,
          COUNT(DISTINCT c.click_id) AS clicks,
          COUNT(DISTINCT a.user_id)  AS registers,
          COUNT(DISTINCT p.id) FILTER (WHERE p.user_id IS NOT NULL) AS first_proof,
          COUNT(DISTINCT pv.proof_id) FILTER (WHERE pv.status = 'approved') AS approved,
          COUNT(DISTINCT r.id) AS rewards
        FROM h
        LEFT JOIN affiliate.clicks c
          ON c.house_id = h.id
          AND c.created_at >= (SELECT from_ts FROM range)
          AND c.created_at <  (SELECT to_ts FROM range)
        LEFT JOIN affiliate.attributions a
          ON a.click_id = c.click_id
        LEFT JOIN validation.proofs p
          ON p.user_id = a.user_id
        LEFT JOIN validation.proof_validations pv
          ON pv.proof_id = p.id
        LEFT JOIN rewards.rewards r
          ON r.proof_id = p.id
        GROUP BY h.slug, h.name
        ORDER BY h.slug
      `;

      try {
        const result = await db.query<{
          slug: string;
          name: string;
          clicks: string;
          registers: string;
          first_proof: string;
          approved: string;
          rewards: string;
        }>(funnelQuery, [fromStr, toStr, houseSlug || null]);

        const funnel = result.rows.map(row => ({
          slug: row.slug,
          name: row.name,
          clicks: parseInt(row.clicks) || 0,
          registers: parseInt(row.registers) || 0,
          first_proof: parseInt(row.first_proof) || 0,
          approved: parseInt(row.approved) || 0,
          rewards: parseInt(row.rewards) || 0,
        }));

        return ok(reply, { funnel, range: { from: fromStr, to: toStr } });
      } catch (err) {
        console.error('[affiliate] funnel query failed:', err);
        return fail(reply, 'Failed to load funnel data');
      }
    }
  );
}