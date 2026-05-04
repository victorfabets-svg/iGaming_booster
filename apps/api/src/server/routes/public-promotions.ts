/**
 * Public-facing promotion routes — no auth required.
 *
 * Used by the landing page to render the featured promotion. Only returns
 * a promotion that is is_featured + active + within its [starts_at, ends_at]
 * window; otherwise responds with `{ promotion: null }` so the landing can
 * fall back to the default hero.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { ok } from '../utils/response';

interface FeaturedRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  creative_type: 'image' | 'video';
  cta_label: string | null;
  cta_url: string | null;
  house_slug: string;
  house_name: string;
  deposit_url: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  raffle_id: string;
  raffle_name: string;
  raffle_prize: string;
  total_numbers: number;
  next_number: number;
}

interface TierRow {
  min_deposit_cents: number;
  tickets: number;
}

export async function publicPromotionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/public/promotions/featured',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<FeaturedRow>(
        `SELECT
           p.id, p.slug, p.name, p.description, p.creative_url,
           p.creative_type, p.cta_label, p.cta_url,
           h.slug AS house_slug, h.name AS house_name, h.deposit_url,
           p.starts_at, p.ends_at, p.draw_at,
           p.raffle_id, r.name AS raffle_name, r.prize AS raffle_prize,
           r.total_numbers, r.next_number
         FROM promotions.promotions p
         JOIN core.houses h ON h.id = p.house_id
         JOIN raffles.raffles r ON r.id = p.raffle_id
         WHERE p.is_featured = TRUE
           AND p.active = TRUE
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()
         LIMIT 1`
      );

      // Cache for 60s — any featured swap by admin propagates within a minute.
      reply.header('Cache-Control', 'public, max-age=60');

      if (result.rows.length === 0) {
        return ok(reply, { promotion: null });
      }

      const promo = result.rows[0];

      const tiersResult = await db.query<TierRow>(
        `SELECT min_deposit_cents, tickets
           FROM promotions.tiers
          WHERE promotion_id = $1
          ORDER BY min_deposit_cents ASC`,
        [promo.id]
      );

      // tickets_emitted = next_number - 1 (numbering starts at 1)
      const ticketsEmitted = Math.max(0, promo.next_number - 1);

      return ok(reply, {
        promotion: {
          slug: promo.slug,
          name: promo.name,
          description: promo.description,
          creative_url: promo.creative_url,
          creative_type: promo.creative_type,
          cta_label: promo.cta_label,
          cta_url: promo.cta_url,
          house_slug: promo.house_slug,
          house_name: promo.house_name,
          starts_at: promo.starts_at,
          ends_at: promo.ends_at,
          draw_at: promo.draw_at,
          raffle: {
            name: promo.raffle_name,
            prize: promo.raffle_prize,
            total_numbers: promo.total_numbers,
            tickets_emitted: ticketsEmitted,
          },
          tiers: tiersResult.rows.map(t => ({
            min_deposit_cents: t.min_deposit_cents,
            tickets: t.tickets,
          })),
        },
      });
    }
  );

  // GET /public/promotions/active — all active promotions in window,
  // grouped by house. Powers the landing's hero grid and the
  // "Como Funciona" per-house listing. No auth, cached 60s.
  fastify.get(
    '/public/promotions/active',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<FeaturedRow & { is_featured: boolean }>(
        `SELECT
           p.id, p.slug, p.name, p.description, p.creative_url,
           p.creative_type, p.cta_label, p.cta_url, p.is_featured,
           h.slug AS house_slug, h.name AS house_name, h.deposit_url,
           p.starts_at, p.ends_at, p.draw_at,
           p.raffle_id, r.name AS raffle_name, r.prize AS raffle_prize,
           r.total_numbers, r.next_number
         FROM promotions.promotions p
         JOIN core.houses h ON h.id = p.house_id
         JOIN raffles.raffles r ON r.id = p.raffle_id
         WHERE p.active = TRUE
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()
         ORDER BY p.is_featured DESC, h.name ASC, p.draw_at ASC`
      );

      reply.header('Cache-Control', 'public, max-age=60');

      const promotions = result.rows.map(row => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        creative_url: row.creative_url,
        creative_type: row.creative_type,
        cta_label: row.cta_label,
        cta_url: row.cta_url,
        is_featured: row.is_featured,
        house_slug: row.house_slug,
        house_name: row.house_name,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        draw_at: row.draw_at,
        raffle: {
          name: row.raffle_name,
          prize: row.raffle_prize,
          total_numbers: row.total_numbers,
          tickets_emitted: Math.max(0, row.next_number - 1),
        },
      }));

      return ok(reply, { promotions });
    }
  );
}
