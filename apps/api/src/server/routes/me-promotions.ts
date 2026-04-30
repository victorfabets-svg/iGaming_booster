/**
 * User-side promotion routes — read-only listing of active promotions and
 * the user's own repescagem invitations + accept/decline flow.
 *
 * Auth: all routes require a logged-in user (any role).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, getClient } from '@shared/database/connection';
import { ok, fail } from '../utils/response';
import { authMiddleware } from '@shared/infrastructure/auth/middleware';

interface PromotionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  house_slug: string;
  house_name: string;
  deposit_url: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  raffle_id: string;
}

interface TierRow {
  promotion_id: string;
  min_deposit_cents: number;
  tickets: number;
}

interface InvitationRow {
  id: string;
  promotion_id: string;
  promotion_slug: string;
  promotion_name: string;
  promotion_creative_url: string | null;
  source_promotion_slug: string;
  source_promotion_name: string;
  raffle_id: string;
  created_at: string;
}

export async function mePromotionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);

  // GET /me/promotions — active promotions in window, with tiers
  fastify.get('/me/promotions', async (_request: FastifyRequest, reply: FastifyReply) => {
    const promosResult = await db.query<PromotionRow>(
      `SELECT
         p.id, p.slug, p.name, p.description, p.creative_url,
         h.slug AS house_slug, h.name AS house_name, h.deposit_url,
         p.starts_at, p.ends_at, p.draw_at, p.raffle_id
       FROM promotions.promotions p
       JOIN core.houses h ON h.id = p.house_id
       WHERE p.active = true
         AND p.starts_at <= NOW()
         AND p.ends_at >= NOW()
       ORDER BY p.ends_at ASC`
    );

    if (promosResult.rows.length === 0) {
      return ok(reply, { promotions: [] });
    }

    const promoIds = promosResult.rows.map(p => p.id);
    const tiersResult = await db.query<TierRow>(
      `SELECT promotion_id, min_deposit_cents, tickets
         FROM promotions.tiers
         WHERE promotion_id = ANY($1::uuid[])
         ORDER BY min_deposit_cents ASC`,
      [promoIds]
    );

    const tiersByPromo = new Map<string, Array<{ min_deposit_cents: number; tickets: number }>>();
    for (const t of tiersResult.rows) {
      if (!tiersByPromo.has(t.promotion_id)) tiersByPromo.set(t.promotion_id, []);
      tiersByPromo.get(t.promotion_id)!.push({
        min_deposit_cents: t.min_deposit_cents,
        tickets: t.tickets,
      });
    }

    const promotions = promosResult.rows.map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      creative_url: p.creative_url,
      house_slug: p.house_slug,
      house_name: p.house_name,
      deposit_url: p.deposit_url,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      draw_at: p.draw_at,
      tiers: tiersByPromo.get(p.id) || [],
    }));

    return ok(reply, { promotions });
  });

  // GET /me/promotions/:slug — single promotion + invitation flag for current user
  fastify.get<{ Params: { slug: string } }>(
    '/me/promotions/:slug',
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { slug } = request.params;

      const promoResult = await db.query<PromotionRow>(
        `SELECT
           p.id, p.slug, p.name, p.description, p.creative_url,
           h.slug AS house_slug, h.name AS house_name, h.deposit_url,
           p.starts_at, p.ends_at, p.draw_at, p.raffle_id
         FROM promotions.promotions p
         JOIN core.houses h ON h.id = p.house_id
         WHERE p.slug = $1 AND p.active = true
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()`,
        [slug]
      );

      if (promoResult.rows.length === 0) {
        return fail(reply, 'Promoção não encontrada ou fora da janela', 'NOT_FOUND');
      }
      const promo = promoResult.rows[0];

      const tiersResult = await db.query<TierRow>(
        `SELECT promotion_id, min_deposit_cents, tickets
           FROM promotions.tiers
           WHERE promotion_id = $1
           ORDER BY min_deposit_cents ASC`,
        [promo.id]
      );

      const inviteResult = await db.query<{ id: string }>(
        `SELECT id FROM promotions.repescagem_invitations
          WHERE promotion_id = $1 AND user_id = $2 AND status = 'pending'`,
        [promo.id, userId]
      );

      return ok(reply, {
        promotion: {
          id: promo.id,
          slug: promo.slug,
          name: promo.name,
          description: promo.description,
          creative_url: promo.creative_url,
          house_slug: promo.house_slug,
          house_name: promo.house_name,
          deposit_url: promo.deposit_url,
          starts_at: promo.starts_at,
          ends_at: promo.ends_at,
          draw_at: promo.draw_at,
          tiers: tiersResult.rows.map(t => ({
            min_deposit_cents: t.min_deposit_cents,
            tickets: t.tickets,
          })),
          user_has_invitation_pending: inviteResult.rows.length > 0,
        },
      });
    }
  );

  // GET /me/repescagem/invitations — current user's pending invitations
  fastify.get(
    '/me/repescagem/invitations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;

      const result = await db.query<InvitationRow>(
        `SELECT
           i.id,
           i.promotion_id,
           p.slug AS promotion_slug,
           p.name AS promotion_name,
           p.creative_url AS promotion_creative_url,
           src.slug AS source_promotion_slug,
           src.name AS source_promotion_name,
           p.raffle_id,
           i.created_at
         FROM promotions.repescagem_invitations i
         JOIN promotions.promotions p ON p.id = i.promotion_id
         JOIN promotions.promotions src ON src.id = i.source_promotion_id
         WHERE i.user_id = $1 AND i.status = 'pending'
         ORDER BY i.created_at DESC`,
        [userId]
      );

      return ok(reply, {
        invitations: result.rows.map(r => ({
          id: r.id,
          promotion_id: r.promotion_id,
          promotion_slug: r.promotion_slug,
          promotion_name: r.promotion_name,
          promotion_creative_url: r.promotion_creative_url,
          source_promotion_slug: r.source_promotion_slug,
          source_promotion_name: r.source_promotion_name,
          created_at: r.created_at,
        })),
      });
    }
  );

  // POST /me/repescagem/invitations/:id/accept — accept invitation and emit ticket
  fastify.post<{ Params: { id: string } }>(
    '/me/repescagem/invitations/:id/accept',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { id: invitationId } = request.params;

      const client = await getClient();
      try {
        await client.query('BEGIN');

        const inviteResult = await client.query<{
          id: string; promotion_id: string; raffle_id: string; status: string;
        }>(
          `SELECT i.id, i.promotion_id, p.raffle_id, i.status
             FROM promotions.repescagem_invitations i
             JOIN promotions.promotions p ON p.id = i.promotion_id
            WHERE i.id = $1 AND i.user_id = $2
            FOR UPDATE OF i`,
          [invitationId, userId]
        );

        if (inviteResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return fail(reply, 'Convite não encontrado', 'NOT_FOUND');
        }

        const invitation = inviteResult.rows[0];
        if (invitation.status !== 'pending') {
          await client.query('ROLLBACK');
          return fail(
            reply,
            `Convite já foi ${invitation.status === 'accepted' ? 'aceito' : 'recusado'}`,
            'INVITATION_ALREADY_DECIDED',
            409
          );
        }

        // Idempotency: if a ticket already exists for this invitation, return it
        const existingTicket = await client.query<{ id: string; number: number; raffle_id: string }>(
          `SELECT id, number, raffle_id
             FROM raffles.tickets
             WHERE repescagem_invitation_id = $1`,
          [invitation.id]
        );
        if (existingTicket.rows.length > 0) {
          await client.query(
            `UPDATE promotions.repescagem_invitations
                SET status = 'accepted', decided_at = NOW()
              WHERE id = $1 AND status = 'pending'`,
            [invitation.id]
          );
          await client.query('COMMIT');
          return ok(reply, {
            invitation: { id: invitation.id, status: 'accepted', decided_at: new Date().toISOString() },
            ticket: existingTicket.rows[0],
          });
        }

        // Lock raffle row, get next_number
        const raffleResult = await client.query<{ next_number: number; total_numbers: number }>(
          `SELECT next_number, total_numbers
             FROM raffles.raffles
             WHERE id = $1
             FOR UPDATE`,
          [invitation.raffle_id]
        );
        if (raffleResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return fail(reply, 'Sorteio da promoção não existe', 'INTERNAL_ERROR');
        }
        const { next_number, total_numbers } = raffleResult.rows[0];
        if (next_number > total_numbers) {
          await client.query('ROLLBACK');
          return fail(reply, 'Sem números disponíveis no sorteio', 'RAFFLE_EXHAUSTED', 409);
        }

        // Insert repescagem ticket (no proof_id, no reward_id; source='repescagem')
        const ticketResult = await client.query<{ id: string; number: number; raffle_id: string }>(
          `INSERT INTO raffles.tickets
             (user_id, raffle_id, number, source, repescagem_invitation_id, promotion_id)
             VALUES ($1, $2, $3, 'repescagem', $4, $5)
             ON CONFLICT (repescagem_invitation_id) DO NOTHING
             RETURNING id, number, raffle_id`,
          [userId, invitation.raffle_id, next_number, invitation.id, invitation.promotion_id]
        );

        if (ticketResult.rows.length === 0) {
          // Race: another concurrent accept won
          const raceResult = await client.query<{ id: string; number: number; raffle_id: string }>(
            `SELECT id, number, raffle_id
               FROM raffles.tickets
               WHERE repescagem_invitation_id = $1`,
            [invitation.id]
          );
          await client.query(
            `UPDATE promotions.repescagem_invitations
                SET status = 'accepted', decided_at = NOW()
              WHERE id = $1 AND status = 'pending'`,
            [invitation.id]
          );
          await client.query('COMMIT');
          return ok(reply, {
            invitation: { id: invitation.id, status: 'accepted', decided_at: new Date().toISOString() },
            ticket: raceResult.rows[0],
          });
        }

        // Increment next_number only on successful insert
        await client.query(
          `UPDATE raffles.raffles SET next_number = next_number + 1 WHERE id = $1`,
          [invitation.raffle_id]
        );

        // Mark invitation accepted
        await client.query(
          `UPDATE promotions.repescagem_invitations
              SET status = 'accepted', decided_at = NOW()
            WHERE id = $1`,
          [invitation.id]
        );

        await client.query('COMMIT');
        return ok(reply, {
          invitation: {
            id: invitation.id,
            status: 'accepted',
            decided_at: new Date().toISOString(),
          },
          ticket: ticketResult.rows[0],
        });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'invitation_accept_failed', err: (err as Error).message });
        return fail(reply, 'Falha ao aceitar convite', 'INTERNAL_ERROR');
      } finally {
        client.release();
      }
    }
  );

  // POST /me/repescagem/invitations/:id/decline — mark declined
  fastify.post<{ Params: { id: string } }>(
    '/me/repescagem/invitations/:id/decline',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { id: invitationId } = request.params;

      const result = await db.query<{ id: string; status: string; decided_at: string }>(
        `UPDATE promotions.repescagem_invitations
            SET status = 'declined', decided_at = NOW()
          WHERE id = $1 AND user_id = $2 AND status = 'pending'
          RETURNING id, status, decided_at`,
        [invitationId, userId]
      );

      if (result.rows.length === 0) {
        return fail(reply, 'Convite não encontrado ou já decidido', 'NOT_FOUND');
      }

      return ok(reply, { invitation: result.rows[0] });
    }
  );
}
