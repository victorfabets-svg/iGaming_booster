import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { ok, fail } from '../utils/response';
import { authMiddleware } from '@shared/infrastructure/auth/middleware';
import argon2 from 'argon2';

// Dummy hash for constant-time comparison (same as auth.ts)
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$axjd+k8652X5zG7/ZZAK1w$YSkkQFQKv3yBYtj//ZVoq/r1rOwKAx/WNURTeWhiYRk';

/**
 * User's ME routes - all require authentication
 */
export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // GET /me - current user info
  fastify.get(
    '/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      const result = await db.query<{
        id: string;
        email: string;
        role: string;
        email_verified: boolean;
        display_name: string | null;
        created_at: Date;
      }>(
        `SELECT id, email, role, email_verified, display_name, created_at 
         FROM identity.users WHERE id = $1`,
        [userId]
      );

      const user = result.rows[0];
      if (!user) {
        return fail(reply, 'User not found', 'NOT_FOUND');
      }

      return ok(reply, {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
        display_name: user.display_name,
        created_at: user.created_at,
      });
    }
  );

  // PATCH /me - update user info
  fastify.patch(
    '/me',
    async (request: FastifyRequest<{ Body: { display_name?: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId;
      const { display_name } = request.body;

      if (display_name !== undefined) {
        await db.query(
          `UPDATE identity.users SET display_name = $1 WHERE id = $2`,
          [display_name.trim() || null, userId]
        );
      }

      // Fetch updated user
      const result = await db.query<{
        id: string;
        email: string;
        role: string;
        email_verified: boolean;
        display_name: string | null;
        created_at: Date;
      }>(
        `SELECT id, email, role, email_verified, display_name, created_at 
         FROM identity.users WHERE id = $1`,
        [userId]
      );

      const user = result.rows[0];
      return ok(reply, {
        id: user.id,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
        display_name: user.display_name,
        created_at: user.created_at,
      });
    }
  );

  // POST /me/change-password
  fastify.post(
    '/me/change-password',
    async (request: FastifyRequest<{ Body: { current_password: string; new_password: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId;
      const { current_password, new_password } = request.body;

      if (!current_password || !new_password) {
        return fail(reply, 'Current and new password required', 'VALIDATION_ERROR');
      }

      if (new_password.length < 8) {
        return fail(reply, 'New password must be at least 8 characters', 'VALIDATION_ERROR');
      }

      // Get current password hash
      const userResult = await db.query<{ password_hash: string | null }>(
        `SELECT password_hash FROM identity.users WHERE id = $1`,
        [userId]
      );
      const user = userResult.rows[0];

      if (!user?.password_hash) {
        return fail(reply, 'No password set', 'NO_PASSWORD');
      }

      // Verify current password
      const isValid = await argon2.verify(user.password_hash, current_password);
      if (!isValid) {
        return fail(reply, 'Current password incorrect', 'INVALID_PASSWORD');
      }

      // Hash new password
      const newHash = await argon2.hash(new_password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
      });

      await db.query(
        `UPDATE identity.users SET password_hash = $1, password_updated_at = NOW() WHERE id = $2`,
        [newHash, userId]
      );

      return ok(reply, { message: 'Password changed successfully' });
    }
  );

  // GET /me/tickets
  fastify.get(
    '/me/tickets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      const result = await db.query<{
        id: string;
        raffle_id: string;
        raffle_name: string;
        ticket_number: number;
        status: string;
        created_at: Date;
      }>(
        `SELECT t.id, t.raffle_id, r.name as raffle_name, t.ticket_number, t.status, t.created_at
         FROM raffles.tickets t
         JOIN raffles.raffles r ON t.raffle_id = r.id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC
         LIMIT 200`,
        [userId]
      );

      return ok(reply, {
        tickets: result.rows,
      });
    }
  );

  // GET /me/raffles
  fastify.get(
    '/me/raffles',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      // Get active raffles + raffles user has tickets in
      const result = await db.query<{
        id: string;
        name: string;
        prize: string;
        draw_date: Date;
        status: string;
        my_ticket_count: number;
        my_ticket_numbers: number[];
      }>(
        `SELECT 
           r.id, r.name, r.prize, r.draw_date, r.status,
           COUNT(t.id) as my_ticket_count,
           CASE WHEN COUNT(t.id) < 20 THEN ARRAY_AGG(t.ticket_number ORDER BY t.ticket_number) END as my_ticket_numbers
         FROM raffles.raffles r
         LEFT JOIN raffles.tickets t ON r.id = t.raffle_id AND t.user_id = $1
         WHERE r.status IN ('active', 'filled', 'drawn')
            OR t.user_id = $1
         GROUP BY r.id
         ORDER BY r.draw_date DESC`,
        [userId]
      );

      const raffles = result.rows.map(r => ({
        id: r.id,
        name: r.name,
        prize: r.prize,
        draw_date: r.draw_date,
        status: r.status,
        my_ticket_count: parseInt(String(r.my_ticket_count), 10),
        my_ticket_numbers: r.my_ticket_numbers,
      }));

      return ok(reply, { raffles });
    }
  );

  // GET /me/raffles/:id
  fastify.get(
    '/me/raffles/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId;
      const { id } = request.params;

      // Get raffle
      const raffleResult = await db.query<{
        id: string;
        name: string;
        prize: string;
        draw_date: Date;
        status: string;
        total_numbers: number;
        winning_number: number | null;
      }>(
        `SELECT id, name, prize, draw_date, status, total_numbers, winning_number
         FROM raffles.raffles WHERE id = $1`,
        [id]
      );

      const raffle = raffleResult.rows[0];
      if (!raffle) {
        return fail(reply, 'Raffle not found', 'NOT_FOUND');
      }

      // Get user's tickets in this raffle
      const ticketsResult = await db.query<{
        id: string;
        ticket_number: number;
        status: string;
        created_at: Date;
      }>(
        `SELECT id, ticket_number, status, created_at
         FROM raffles.tickets 
         WHERE raffle_id = $1 AND user_id = $2
         ORDER BY ticket_number`,
        [id, userId]
      );

      return ok(reply, {
        raffle: {
          id: raffle.id,
          name: raffle.name,
          prize: raffle.prize,
          draw_date: raffle.draw_date,
          status: raffle.status,
          total_numbers: raffle.total_numbers,
          winning_number: raffle.winning_number,
        },
        tickets: ticketsResult.rows,
      });
    }
  );

  // GET /me/subscription
  fastify.get(
    '/me/subscription',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      const result = await db.query<{
        id: string;
        plan_slug: string;
        plan_name: string;
        status: string;
        current_period_end: Date;
        created_at: Date;
      }>(
        `SELECT s.id, s.plan_slug, p.name as plan_name, s.status, s.current_period_end, s.created_at
         FROM subscription.subscriptions s
         JOIN subscription.plans p ON s.plan_slug = p.slug
         WHERE s.user_id = $1 AND s.status IN ('active', 'pending')
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [userId]
      );

      const subscription = result.rows[0];
      return ok(reply, { subscription: subscription || null });
    }
  );

  // GET /me/tips
  fastify.get(
    '/me/tips',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId;

      // Check if user has active subscription
      const subResult = await db.query<{ id: string }>(
        `SELECT id FROM subscription.subscriptions 
         WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW()
         LIMIT 1`,
        [userId]
      );

      if (!subResult.rows[0]) {
        return ok(reply, { 
          tips: [], 
          locked: true, 
          reason: 'subscription_required' 
        });
      }

      // Get last 30 days of tips
      const tipsResult = await db.query<{
        id: string;
        house: string;
        market: string;
        odds: number;
        status: string;
        created_at: Date;
      }>(
        `SELECT id, house, market, odds, status, created_at
         FROM tipster.tips
         WHERE created_at > NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC`,
        []
      );

      return ok(reply, { 
        tips: tipsResult.rows, 
        locked: false 
      });
    }
  );
}