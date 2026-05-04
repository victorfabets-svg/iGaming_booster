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
  // Canonical affiliate redirect: /r/c/:slug
  // Registers click, sets cookie, redirects to house or /signup
  fastify.get<{ Params: { slug: string } }>(
    '/r/c/:slug',
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const { slug } = request.params;

      // Get client info
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

      // Lookup campaign by slug
      const campaignResult = await db.query<{
        id: string;
        slug: string;
        redirect_house_id: string | null;
        owner_user_id: string | null;
      }>(
        `SELECT id, slug, redirect_house_id, owner_user_id 
         FROM affiliate.campaigns WHERE slug = $1`,
        [slug]
      );

      if (campaignResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Campaign not found', code: 'NOT_FOUND' }
        });
      }

      const campaign = campaignResult.rows[0];
      const clickId = randomUUID();

      // Insert click
      try {
        await db.query(
          `INSERT INTO affiliate.clicks (
            house_id, campaign_id, click_id, ip, user_agent, ref_cookie,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content, country
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            campaign.redirect_house_id,
            campaign.id,
            clickId,
            ip,
            userAgent,
            null,
            utmSource,
            utmMedium,
            utmCampaign,
            utmTerm,
            utmContent,
            country
          ]
        );
      } catch (err) {
        console.error('[affiliate] canonical click insert failed:', err);
      }

      // Set cookie for attribution
      const isProduction = process.env.NODE_ENV === 'production';
      reply.setCookie('tipster_cid', clickId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 90 * 24 * 60 * 60,
      });

      // Determine destination
      let destination: string;
      if (campaign.redirect_house_id) {
        // Redirect to house
        const houseResult = await db.query<{ base_url: string }>(
          `SELECT base_url FROM affiliate.houses WHERE id = $1`,
          [campaign.redirect_house_id]
        );

        if (houseResult.rows.length === 0) {
          // Fallback to signup if house not found
          destination = `${process.env.WEB_BASE_URL || 'http://localhost:5173'}/signup?ref=${clickId}`;
        } else {
          const house = houseResult.rows[0];
          const url = new URL(house.base_url);
          if (utmSource) url.searchParams.set('utm_source', utmSource);
          if (utmMedium) url.searchParams.set('utm_medium', utmMedium);
          if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign);
          if (utmTerm) url.searchParams.set('utm_term', utmTerm);
          if (utmContent) url.searchParams.set('utm_content', utmContent);
          destination = url.toString();
        }
      } else {
        // Redirect to signup
        destination = `${process.env.WEB_BASE_URL || 'http://localhost:5173'}/signup?ref=${clickId}`;
      }

      return reply.status(302).header('Location', destination).send();
    }
  );

  // Promotion-based redirect: /r/p/:promo_slug
  // Records a click against the promo's house (when an affiliate.houses entry
  // exists for that core.house) and sends the user to /signup with `ref` so
  // the SPA can forward it as `cid` to /register — important because API
  // and web live on different domains in production (cookies cross-site
  // are unreliable, so we duplicate via query string).
  fastify.get<{ Params: { promo_slug: string } }>(
    '/r/p/:promo_slug',
    async (request: FastifyRequest<{ Params: { promo_slug: string } }>, reply: FastifyReply) => {
      const { promo_slug } = request.params;

      const ip = request.ip
        || (request.headers['x-forwarded-for'] as string)
        || 'unknown';
      const userAgent = request.headers['user-agent'];
      const country = request.headers['cf-ipcountry'] as string
        || request.headers['x-vercel-ip-country'] as string
        || null;

      const utmSource = request.query['utm_source'] as string | undefined;
      const utmMedium = request.query['utm_medium'] as string | undefined;
      const utmCampaign = request.query['utm_campaign'] as string | undefined;
      const utmTerm = request.query['utm_term'] as string | undefined;
      const utmContent = request.query['utm_content'] as string | undefined;

      // Resolve promo → its core.house → matching affiliate.house (if any).
      // Window check (active + starts/ends) is enforced so an unpublished or
      // expired promo can't keep generating clicks.
      const promoResult = await db.query<{
        promo_id: string;
        promo_name: string;
        core_house_id: string;
        affiliate_house_id: string | null;
      }>(
        `SELECT
           p.id AS promo_id,
           p.name AS promo_name,
           p.house_id AS core_house_id,
           ah.id AS affiliate_house_id
         FROM promotions.promotions p
         LEFT JOIN affiliate.houses ah ON ah.house_id = p.house_id AND ah.active = true
         WHERE p.slug = $1
           AND p.active = true
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()
         LIMIT 1`,
        [promo_slug]
      );

      const webBase = process.env.WEB_BASE_URL || 'http://localhost:5173';

      if (promoResult.rows.length === 0) {
        // Promo invalid/expired — still let the user reach signup, no tracking.
        return reply
          .status(302)
          .header('Location', `${webBase}/signup`)
          .send();
      }

      const promo = promoResult.rows[0];
      const signupUrl = new URL(`${webBase}/signup`);
      signupUrl.searchParams.set('promo', promo_slug);
      signupUrl.searchParams.set('promo_name', promo.promo_name);

      if (!promo.affiliate_house_id) {
        // No affiliate.houses entry for this promo's house → cannot attribute.
        // Still redirect to signup with promo context (no ref).
        return reply.status(302).header('Location', signupUrl.toString()).send();
      }

      const clickId = randomUUID();
      try {
        await db.query(
          `INSERT INTO affiliate.clicks (
            house_id, campaign_id, click_id, ip, user_agent, ref_cookie,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content, country
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            promo.affiliate_house_id,
            null,
            clickId,
            ip,
            userAgent,
            null,
            utmSource,
            utmMedium,
            utmCampaign,
            utmTerm,
            utmContent,
            country,
          ]
        );
      } catch (err) {
        console.error('[affiliate] promo click insert failed:', err);
        // Click insert failed — bail out gracefully without ref.
        return reply.status(302).header('Location', signupUrl.toString()).send();
      }

      const isProduction = process.env.NODE_ENV === 'production';
      reply.setCookie('tipster_cid', clickId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 90 * 24 * 60 * 60,
      });

      // Pass click_id via query string so the SPA can forward it as `cid`
      // even when cookies are blocked (cross-site cookie suppression).
      signupUrl.searchParams.set('ref', clickId);

      return reply.status(302).header('Location', signupUrl.toString()).send();
    }
  );

  // Promotion deposit redirect: /r/p/:promo_slug/deposit
  // Same tracking as /r/p/:slug (records click + sets cookie) but the
  // destination is the partner house's deposit_url instead of /signup.
  // Used by the landing's "Fazer depósito" button so the operator can
  // attribute conversions even when the user goes straight to deposit.
  fastify.get<{ Params: { promo_slug: string } }>(
    '/r/p/:promo_slug/deposit',
    async (request: FastifyRequest<{ Params: { promo_slug: string } }>, reply: FastifyReply) => {
      const { promo_slug } = request.params;

      const ip = request.ip
        || (request.headers['x-forwarded-for'] as string)
        || 'unknown';
      const userAgent = request.headers['user-agent'];
      const country = request.headers['cf-ipcountry'] as string
        || request.headers['x-vercel-ip-country'] as string
        || null;

      const utmSource = request.query['utm_source'] as string | undefined;
      const utmMedium = request.query['utm_medium'] as string | undefined;
      const utmCampaign = request.query['utm_campaign'] as string | undefined;
      const utmTerm = request.query['utm_term'] as string | undefined;
      const utmContent = request.query['utm_content'] as string | undefined;

      // Resolve promo → core.house deposit_url + matching affiliate.house.
      const promoResult = await db.query<{
        deposit_url: string;
        affiliate_house_id: string | null;
      }>(
        `SELECT
           h.deposit_url,
           ah.id AS affiliate_house_id
         FROM promotions.promotions p
         JOIN core.houses h ON h.id = p.house_id
         LEFT JOIN affiliate.houses ah ON ah.house_id = p.house_id AND ah.active = true
         WHERE p.slug = $1
           AND p.active = true
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()
         LIMIT 1`,
        [promo_slug]
      );

      const webBase = process.env.WEB_BASE_URL || 'http://localhost:5173';

      if (promoResult.rows.length === 0) {
        // Promo invalid — bounce to landing rather than dead-end.
        return reply.status(302).header('Location', webBase).send();
      }

      const { deposit_url: depositUrl, affiliate_house_id } = promoResult.rows[0];

      // Try to record click (best-effort). If the house has no affiliate
      // entry, we still redirect — just without tracking.
      if (affiliate_house_id) {
        const clickId = randomUUID();
        try {
          await db.query(
            `INSERT INTO affiliate.clicks (
              house_id, campaign_id, click_id, ip, user_agent, ref_cookie,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content, country
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              affiliate_house_id, null, clickId, ip, userAgent, null,
              utmSource, utmMedium, utmCampaign, utmTerm, utmContent, country,
            ]
          );

          const isProduction = process.env.NODE_ENV === 'production';
          reply.setCookie('tipster_cid', clickId, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 90 * 24 * 60 * 60,
          });
        } catch (err) {
          console.error('[affiliate] promo deposit click insert failed:', err);
        }
      }

      // Forward UTM params to the house URL.
      const dest = new URL(depositUrl);
      if (utmSource) dest.searchParams.set('utm_source', utmSource);
      if (utmMedium) dest.searchParams.set('utm_medium', utmMedium);
      if (utmCampaign) dest.searchParams.set('utm_campaign', utmCampaign);
      if (utmTerm) dest.searchParams.set('utm_term', utmTerm);
      if (utmContent) dest.searchParams.set('utm_content', utmContent);

      return reply.status(302).header('Location', dest.toString()).send();
    }
  );

  // Legacy affiliate redirect: /r/:house_slug/:campaign_slug?
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