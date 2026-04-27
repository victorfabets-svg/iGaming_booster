/**
 * Admin Subscription Routes
 * Admin endpoints for managing subscription plans and subscriptions (admin role required)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import {
  insertWithClient as insertPlan,
  updateWithClient as updatePlan,
  deactivateWithClient,
  reactivateWithClient,
  findBySlug,
  listAll as listPlans,
  PlanInput,
  PlanUpdate,
} from '../../domains/subscription/plans.repository';
import {
  insertWithClient as insertSubscription,
  updateStatusWithClient,
  cancelByIdWithClient,
  findById as findSubscriptionById,
  listAll as listSubscriptions,
  SubscriptionFilters,
} from '../../domains/subscription/subscriptions.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { db } from '@shared/database/connection';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9-]+$/;

// ============================================================================
// Plans Routes (6 endpoints)
// ============================================================================

interface PlanCreateBody {
  slug: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'annual';
  metadata?: Record<string, unknown>;
}

interface PlanUpdateBody {
  name?: string;
  description?: string | null;
  price_cents?: number;
  metadata?: Record<string, unknown>;
}

interface PlanSlugParams {
  slug: string;
}

interface PlanListQuery {
  active?: 'true' | 'false' | 'all';
  limit?: string;
}

// ============================================================================
// Subscriptions Routes (4 endpoints)
// ============================================================================

interface SubscriptionListQuery {
  status?: 'pending' | 'active' | 'canceled' | 'expired';
  user_id?: string;
  plan_slug?: string;
  since?: string;
  limit?: string;
}

interface SubscriptionIdParams {
  id: string;
}

interface SubscriptionCreateBody {
  external_id: string;
  user_id?: string;
  plan_slug: string;
  status?: 'pending' | 'active' | 'canceled' | 'expired';
  current_period_start?: string;
  current_period_end?: string;
  amount_cents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

interface SubscriptionCancelBody {
  reason: string;
}

/**
 * Parse ISO timestamp string to Date, returning null for invalid dates
 */
function parseIsoTimestamp(s: unknown): Date | null {
  if (typeof s !== 'string' || !s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Validate plan create body
 */
function validatePlanCreateBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  if (typeof b.slug !== 'string' || !b.slug) {
    return 'slug is required and must be a non-empty string';
  }

  if (!SLUG_REGEX.test(b.slug)) {
    return 'slug must match pattern ^[a-z0-9-]+$';
  }

  if (typeof b.name !== 'string' || !b.name) {
    return 'name is required and must be a non-empty string';
  }

  if (typeof b.price_cents !== 'number' || b.price_cents < 0) {
    return 'price_cents is required and must be >= 0';
  }

  if (typeof b.currency !== 'string' || b.currency.length !== 3) {
    return 'currency is required and must be 3 characters';
  }

  if (!['monthly', 'annual'].includes(b.billing_cycle as string)) {
    return 'billing_cycle must be either monthly or annual';
  }

  return null;
}

/**
 * Validate plan update body
 */
function validatePlanUpdateBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  // Check for immutable fields
  if (b.slug !== undefined) {
    return 'slug is immutable and cannot be changed';
  }

  if (b.currency !== undefined) {
    return 'currency is immutable and cannot be changed';
  }

  if (b.billing_cycle !== undefined) {
    return 'billing_cycle is immutable and cannot be changed';
  }

  // Validate mutable fields
  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name) {
      return 'name must be a non-empty string';
    }
  }

  if (b.price_cents !== undefined) {
    if (typeof b.price_cents !== 'number' || b.price_cents < 0) {
      return 'price_cents must be >= 0';
    }
  }

  return null;
}

/**
 * Validate subscription create body
 */
function validateSubscriptionCreateBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  if (typeof b.external_id !== 'string' || !b.external_id) {
    return 'external_id is required and must be a non-empty string';
  }

  if (typeof b.plan_slug !== 'string' || !b.plan_slug) {
    return 'plan_slug is required and must be a non-empty string';
  }

  if (b.status !== undefined) {
    if (!['pending', 'active', 'canceled', 'expired'].includes(b.status as string)) {
      return 'status must be one of: pending, active, canceled, expired';
    }
  }

  if (b.user_id !== undefined && b.user_id !== null) {
    if (typeof b.user_id !== 'string' || !UUID_REGEX.test(b.user_id)) {
      return 'user_id must be a valid UUID if provided';
    }
  }

  return null;
}

export async function adminSubscriptionRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // =========================================================================
  // PLANS ENDPOINTS (6)
  // =========================================================================

  // POST /admin/subscriptions/plans - Create a new plan
  fastify.post<{ Body: PlanCreateBody }>(
    '/admin/subscriptions/plans',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Body: PlanCreateBody }>,
      reply: FastifyReply
    ) => {
      const validationError = validatePlanCreateBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const input: PlanInput = {
          slug: body.slug,
          name: body.name,
          description: body.description ?? null,
          price_cents: body.price_cents,
          currency: body.currency.toUpperCase(),
          billing_cycle: body.billing_cycle,
          metadata: body.metadata ?? {},
        };

        const plan = await insertPlan(client, input);

        // If plan already exists (idempotent), return existing
        if (!plan) {
          await client.query('ROLLBACK');
          const existing = await findBySlug(body.slug);
          if (existing) {
            return reply.status(200).send({ plan: existing });
          }
          return reply.status(500).send({ error: 'Failed to create plan' });
        }

        await insertEventInTransaction(
          client,
          'plan_created',
          {
            plan_id: plan.id,
            slug: plan.slug,
            name: plan.name,
            price_cents: plan.price_cents,
            currency: plan.currency,
            billing_cycle: plan.billing_cycle,
          },
          'subscription'
        );

        await insertAuditInTransaction(
          client,
          'plan_created',
          'subscription',
          plan.id,
          (request as any).userId ?? null,
          { slug: plan.slug, price_cents: plan.price_cents }
        );

        await client.query('COMMIT');
        return reply.status(201).send({ plan });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'plan_create_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // GET /admin/subscriptions/plans - List all plans with filters
  fastify.get<{ Querystring: PlanListQuery }>(
    '/admin/subscriptions/plans',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Querystring: PlanListQuery }>,
      reply: FastifyReply
    ) => {
      const { active, limit: limitStr } = request.query;

      // Parse and validate limit
      let limit = DEFAULT_LIMIT;
      if (limitStr) {
        limit = parseInt(limitStr, 10);
        if (isNaN(limit) || limit < 1) {
          return reply.status(400).send({ error: 'limit must be a positive integer' });
        }
        if (limit > MAX_LIMIT) {
          limit = MAX_LIMIT;
        }
      }

      // Parse active filter
      let activeFilter: boolean | undefined;
      if (active === 'true') {
        activeFilter = true;
      } else if (active === 'false') {
        activeFilter = false;
      }
      // 'all' or undefined: no filter

      const plans = await listPlans(
        activeFilter !== undefined ? { active: activeFilter } : undefined,
        limit
      );
      return reply.status(200).send({ plans });
    }
  );

  // GET /admin/subscriptions/plans/:slug - Get a single plan
  fastify.get<{ Params: PlanSlugParams }>(
    '/admin/subscriptions/plans/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: PlanSlugParams }>,
      reply: FastifyReply
    ) => {
      const { slug } = request.params;

      if (!SLUG_REGEX.test(slug)) {
        return reply.status(400).send({ error: 'Invalid slug format' });
      }

      const plan = await findBySlug(slug);
      if (!plan) {
        return reply.status(404).send({ error: 'Plan not found' });
      }

      return reply.status(200).send({ plan });
    }
  );

  // PATCH /admin/subscriptions/plans/:slug - Update a plan
  fastify.patch<{ Params: PlanSlugParams; Body: PlanUpdateBody }>(
    '/admin/subscriptions/plans/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: PlanSlugParams; Body: PlanUpdateBody }>,
      reply: FastifyReply
    ) => {
      const { slug } = request.params;

      if (!SLUG_REGEX.test(slug)) {
        return reply.status(400).send({ error: 'Invalid slug format' });
      }

      const validationError = validatePlanUpdateBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const update: PlanUpdate = {};
        if (body.name !== undefined) update.name = body.name;
        if (body.description !== undefined) update.description = body.description;
        if (body.price_cents !== undefined) update.price_cents = body.price_cents;
        if (body.metadata !== undefined) update.metadata = body.metadata;

        const plan = await updatePlan(client, slug, update);

        if (!plan) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'Plan not found' });
        }

        await insertEventInTransaction(
          client,
          'plan_updated',
          {
            plan_id: plan.id,
            slug: plan.slug,
            updated_fields: Object.keys(update),
          },
          'subscription'
        );

        await insertAuditInTransaction(
          client,
          'plan_updated',
          'subscription',
          plan.id,
          (request as any).userId ?? null,
          update
        );

        await client.query('COMMIT');
        return reply.status(200).send({ plan });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'plan_update_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // POST /admin/subscriptions/plans/:slug/deactivate - Deactivate a plan
  fastify.post<{ Params: PlanSlugParams }>(
    '/admin/subscriptions/plans/:slug/deactivate',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: PlanSlugParams }>,
      reply: FastifyReply
    ) => {
      const { slug } = request.params;

      if (!SLUG_REGEX.test(slug)) {
        return reply.status(400).send({ error: 'Invalid slug format' });
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const plan = await deactivateWithClient(client, slug);

        if (!plan) {
          await client.query('ROLLBACK');
          // Check if plan exists but is already inactive (idempotent)
          const existing = await findBySlug(slug);
          if (existing) {
            return reply.status(200).send({ plan: existing, message: 'Plan already inactive' });
          }
          return reply.status(404).send({ error: 'Plan not found' });
        }

        await insertEventInTransaction(
          client,
          'plan_deactivated',
          {
            plan_id: plan.id,
            slug: plan.slug,
          },
          'subscription'
        );

        await insertAuditInTransaction(
          client,
          'plan_deactivated',
          'subscription',
          plan.id,
          (request as any).userId ?? null,
          { slug: plan.slug }
        );

        await client.query('COMMIT');
        return reply.status(200).send({ plan });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'plan_deactivate_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // POST /admin/subscriptions/plans/:slug/reactivate - Reactivate a plan
  fastify.post<{ Params: PlanSlugParams }>(
    '/admin/subscriptions/plans/:slug/reactivate',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: PlanSlugParams }>,
      reply: FastifyReply
    ) => {
      const { slug } = request.params;

      if (!SLUG_REGEX.test(slug)) {
        return reply.status(400).send({ error: 'Invalid slug format' });
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const plan = await reactivateWithClient(client, slug);

        if (!plan) {
          await client.query('ROLLBACK');
          const existing = await findBySlug(slug);
          if (existing) {
            return reply.status(200).send({ plan: existing, message: 'Plan already active' });
          }
          return reply.status(404).send({ error: 'Plan not found' });
        }

        await insertEventInTransaction(
          client,
          'plan_reactivated',
          {
            plan_id: plan.id,
            slug: plan.slug,
          },
          'subscription'
        );

        await insertAuditInTransaction(
          client,
          'plan_reactivated',
          'subscription',
          plan.id,
          (request as any).userId ?? null,
          { slug: plan.slug }
        );

        await client.query('COMMIT');
        return reply.status(200).send({ plan });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'plan_reactivate_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // =========================================================================
  // SUBSCRIPTIONS ENDPOINTS (4)
  // =========================================================================

  // GET /admin/subscriptions - List all subscriptions with filters
  fastify.get<{ Querystring: SubscriptionListQuery }>(
    '/admin/subscriptions',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Querystring: SubscriptionListQuery }>,
      reply: FastifyReply
    ) => {
      const { status, user_id, plan_slug, since, limit: limitStr } = request.query;

      // Parse and validate limit
      let limit = DEFAULT_LIMIT;
      if (limitStr) {
        limit = parseInt(limitStr, 10);
        if (isNaN(limit) || limit < 1) {
          return reply.status(400).send({ error: 'limit must be a positive integer' });
        }
        if (limit > MAX_LIMIT) {
          limit = MAX_LIMIT;
        }
      }

      // Validate status enum
      if (status) {
        if (!['pending', 'active', 'canceled', 'expired'].includes(status)) {
          return reply.status(400).send({ error: 'Invalid status filter' });
        }
      }

      // Validate UUID for user_id
      if (user_id) {
        if (!UUID_REGEX.test(user_id)) {
          return reply.status(400).send({ error: 'user_id must be a valid UUID' });
        }
      }

      // Parse since timestamp
      let sinceDate: Date | undefined;
      if (since) {
        sinceDate = parseIsoTimestamp(since) ?? undefined;
        if (since && !sinceDate) {
          return reply.status(400).send({ error: 'Invalid since timestamp' });
        }
      }

      const filters: SubscriptionFilters = {};
      if (status) filters.status = status;
      if (user_id) filters.user_id = user_id;
      if (plan_slug) filters.plan_slug = plan_slug;
      if (sinceDate) filters.since = sinceDate;

      const subscriptions = await listSubscriptions(filters, limit);
      return reply.status(200).send({ subscriptions });
    }
  );

  // GET /admin/subscriptions/:id - Get a single subscription
  fastify.get<{ Params: SubscriptionIdParams }>(
    '/admin/subscriptions/:id',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: SubscriptionIdParams }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: 'Invalid subscription ID format' });
      }

      const subscription = await findSubscriptionById(id);
      if (!subscription) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }

      return reply.status(200).send({ subscription });
    }
  );

  // POST /admin/subscriptions - Create a subscription manually
  fastify.post<{ Body: SubscriptionCreateBody }>(
    '/admin/subscriptions',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Body: SubscriptionCreateBody }>,
      reply: FastifyReply
    ) => {
      const validationError = validateSubscriptionCreateBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        // FIX-27: Pre-check plan_slug exists AND is active
        const plan = await findBySlug(body.plan_slug);
        if (!plan) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: `Plan '${body.plan_slug}' not found` });
        }
        if (!plan.active) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: `Plan '${body.plan_slug}' is inactive` });
        }

        const input = {
          external_id: body.external_id,
          user_id: body.user_id ?? null,
          plan_slug: body.plan_slug,
          status: body.status ?? 'active',
          current_period_start: parseIsoTimestamp(body.current_period_start),
          current_period_end: parseIsoTimestamp(body.current_period_end),
          amount_cents: body.amount_cents ?? null,
          currency: body.currency ?? null,
          provider: 'admin',
          metadata: body.metadata ?? {},
        };

        const subscription = await insertSubscription(client, input);

        // If subscription already exists (idempotent), return existing
        if (!subscription) {
          await client.query('ROLLBACK');
          return reply.status(409).send({ error: 'Subscription with this external_id already exists' });
        }

        // Emit subscription_activated if status is 'active'
        if (subscription.status === 'active') {
          await insertEventInTransaction(
            client,
            'subscription_activated',
            {
              subscription_id: subscription.id,
              external_id: subscription.external_id,
              user_id: subscription.user_id,
              plan_slug: subscription.plan_slug,
              provider: 'admin',
            },
            'subscription'
          );
        }

        await insertAuditInTransaction(
          client,
          'subscription_created',
          'subscription',
          subscription.id,
          (request as any).userId ?? null,
          { external_id: subscription.external_id, plan_slug: subscription.plan_slug }
        );

        await client.query('COMMIT');
        return reply.status(201).send({ subscription });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'subscription_create_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // POST /admin/subscriptions/:id/cancel - Cancel a subscription
  fastify.post<{ Params: SubscriptionIdParams; Body: SubscriptionCancelBody }>(
    '/admin/subscriptions/:id/cancel',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: SubscriptionIdParams; Body: SubscriptionCancelBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { reason } = request.body;

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({ error: 'Invalid subscription ID format' });
      }

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return reply.status(400).send({ error: 'reason is required and must be non-empty' });
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const subscription = await cancelByIdWithClient(
          client,
          id,
          new Date(),
          { cancel_reason: reason.trim() }
        );

        if (!subscription) {
          await client.query('ROLLBACK');
          const existing = await findSubscriptionById(id);
          if (!existing) {
            return reply.status(404).send({ error: 'Subscription not found' });
          }
          if (existing.status === 'canceled') {
            return reply.status(200).send({ subscription: existing, message: 'Already canceled' });
          }
          if (existing.status === 'expired') {
            return reply.status(409).send({ error: 'Cannot cancel: subscription already expired' });
          }
          return reply.status(500).send({ error: 'Failed to cancel subscription' });
        }

        await insertEventInTransaction(
          client,
          'subscription_canceled',
          {
            subscription_id: subscription.id,
            external_id: subscription.external_id,
            user_id: subscription.user_id,
            plan_slug: subscription.plan_slug,
            canceled_at: subscription.canceled_at,
            reason,
          },
          'subscription'
        );

        await insertAuditInTransaction(
          client,
          'subscription_canceled',
          'subscription',
          subscription.id,
          (request as any).userId ?? null,
          { reason }
        );

        await client.query('COMMIT');
        return reply.status(200).send({ subscription });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'subscription_cancel_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );
}