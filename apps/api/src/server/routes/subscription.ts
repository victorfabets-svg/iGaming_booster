/**
 * Subscription Webhook Routes
 * PSP-agnostic webhook for receiving subscription events
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ok } from '../utils/response';
import { subscriptionAuthMiddleware } from '../middleware/subscription-auth';
import {
  insertWithClient as insertWebhookEvent
} from '../../domains/subscription/webhook-events.repository';
import {
  insertWithClient as insertSubscription,
  updateStatusWithClient,
  findByExternalId,
} from '../../domains/subscription/subscriptions.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { db } from '@shared/database/connection';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WebhookBody {
  external_event_id: string;
  event_type: 'subscription.activated' | 'subscription.renewed' | 'subscription.canceled' |
              'subscription.expired' | 'subscription.payment_failed';
  external_id: string;
  user_id?: string;
  plan_slug: string;
  provider: string;
  amount_cents?: number;
  currency?: string;
  current_period_start?: string;
  current_period_end?: string;
  metadata?: Record<string, unknown>;
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
 * Validate webhook body
 */
function validateWebhookBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  // Required fields
  if (typeof b.external_event_id !== 'string' || !b.external_event_id) {
    return 'external_event_id is required and must be a non-empty string';
  }

  const validEventTypes = [
    'subscription.activated',
    'subscription.renewed',
    'subscription.canceled',
    'subscription.expired',
    'subscription.payment_failed',
  ];
  if (!validEventTypes.includes(b.event_type as string)) {
    return `event_type must be one of: ${validEventTypes.join(', ')}`;
  }

  if (typeof b.external_id !== 'string' || !b.external_id) {
    return 'external_id is required and must be a non-empty string';
  }

  if (typeof b.plan_slug !== 'string' || !b.plan_slug) {
    return 'plan_slug is required and must be a non-empty string';
  }

  if (typeof b.provider !== 'string' || !b.provider) {
    return 'provider is required and must be a non-empty string';
  }

  // Optional UUID validation for user_id
  if (b.user_id !== undefined && b.user_id !== null) {
    if (typeof b.user_id !== 'string' || !UUID_REGEX.test(b.user_id)) {
      return 'user_id must be a valid UUID if provided';
    }
  }

  // Parse timestamps
  if (b.current_period_start !== undefined && b.current_period_start !== null) {
    if (typeof b.current_period_start !== 'string' || parseIsoTimestamp(b.current_period_start) === null) {
      return 'current_period_start must be a valid ISO timestamp if provided';
    }
  }

  if (b.current_period_end !== undefined && b.current_period_end !== null) {
    if (typeof b.current_period_end !== 'string' || parseIsoTimestamp(b.current_period_end) === null) {
      return 'current_period_end must be a valid ISO timestamp if provided';
    }
  }

  return null;
}

export async function subscriptionRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // POST /subscriptions/webhook
  fastify.post<{ Body: WebhookBody }>(
    '/subscriptions/webhook',
    { preHandler: subscriptionAuthMiddleware },
    async (
      request: FastifyRequest<{ Body: WebhookBody }>,
      reply: FastifyReply
    ) => {
      const validationError = validateWebhookBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        // Idempotency check via external_event_id
        const webhookEvent = await insertWebhookEvent(
          client,
          body.external_event_id,
          body.event_type,
          body.provider,
          body as unknown as Record<string, unknown>
        );

        // If null, this is a duplicate delivery - idempotent return
        if (!webhookEvent) {
          await client.query('ROLLBACK');
          return reply.status(200).send({ message: 'Event already processed' });
        }

        let subscription: any = null;

        // Branch by event type
        switch (body.event_type) {
          case 'subscription.activated': {
            // Try to insert new subscription
            subscription = await insertSubscription(client, {
              external_id: body.external_id,
              user_id: body.user_id ?? null,
              plan_slug: body.plan_slug,
              status: 'active',
              current_period_start: parseIsoTimestamp(body.current_period_start),
              current_period_end: parseIsoTimestamp(body.current_period_end),
              amount_cents: body.amount_cents ?? null,
              currency: body.currency ?? null,
              provider: body.provider,
              metadata: body.metadata ?? {},
            });

            // If subscription already exists, try to update to active
            if (!subscription) {
              subscription = await updateStatusWithClient(
                client,
                body.external_id,
                'active',
                {
                  current_period_start: parseIsoTimestamp(body.current_period_start),
                  current_period_end: parseIsoTimestamp(body.current_period_end),
                  amount_cents: body.amount_cents ?? null,
                }
              );
            }

            // FIX-29: Guard against null deref - subscription exists but in terminal state
            if (!subscription) {
              await client.query('ROLLBACK');
              request.log.warn({
                event: 'subscription_activate_terminal_state',
                external_id: body.external_id,
                external_event_id: body.external_event_id,
              });
              return reply.status(409).send({
                error: 'Cannot activate: subscription is in terminal state (canceled/expired)',
                external_id: body.external_id,
              });
            }

            await insertEventInTransaction(
              client,
              'subscription_activated',
              {
                subscription_id: subscription.id,
                external_id: subscription.external_id,
                user_id: subscription.user_id,
                plan_slug: subscription.plan_slug,
                provider: subscription.provider,
              },
              'subscription'
            );
            break;
          }

          case 'subscription.renewed': {
            subscription = await updateStatusWithClient(
              client,
              body.external_id,
              'active',
              {
                current_period_start: parseIsoTimestamp(body.current_period_start),
                current_period_end: parseIsoTimestamp(body.current_period_end),
                amount_cents: body.amount_cents ?? null,
              }
            );

            if (!subscription) {
              // FIX-31: distinguish 404 (not found) from 409 (invalid transition)
              await client.query('ROLLBACK');
              const existing = await findByExternalId(body.external_id);

              if (!existing) {
                request.log.warn({
                  event: 'subscription_webhook_not_found',
                  event_type: body.event_type,
                  external_id: body.external_id,
                });
                return reply.status(404).send({
                  error: 'Subscription not found',
                  external_id: body.external_id,
                });
              }

              request.log.warn({
                event: 'subscription_webhook_invalid_transition',
                event_type: body.event_type,
                external_id: body.external_id,
                current_status: existing.status,
              });
              return reply.status(409).send({
                error: 'Invalid status transition',
                external_id: body.external_id,
                current_status: existing.status,
                attempted_status: 'active',
              });
            }

            await insertEventInTransaction(
              client,
              'subscription_renewed',
              {
                subscription_id: subscription.id,
                external_id: subscription.external_id,
                user_id: subscription.user_id,
                plan_slug: subscription.plan_slug,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
              },
              'subscription'
            );
            break;
          }

          case 'subscription.canceled': {
            subscription = await updateStatusWithClient(
              client,
              body.external_id,
              'canceled',
              { canceled_at: new Date() }
            );

            if (!subscription) {
              // FIX-31: distinguish 404 (not found) from 409 (invalid transition)
              await client.query('ROLLBACK');
              const existing = await findByExternalId(body.external_id);

              if (!existing) {
                request.log.warn({
                  event: 'subscription_webhook_not_found',
                  event_type: body.event_type,
                  external_id: body.external_id,
                });
                return reply.status(404).send({
                  error: 'Subscription not found',
                  external_id: body.external_id,
                });
              }

              request.log.warn({
                event: 'subscription_webhook_invalid_transition',
                event_type: body.event_type,
                external_id: body.external_id,
                current_status: existing.status,
              });
              return reply.status(409).send({
                error: 'Invalid status transition',
                external_id: body.external_id,
                current_status: existing.status,
                attempted_status: 'canceled',
              });
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
              },
              'subscription'
            );
            break;
          }

          case 'subscription.expired': {
            subscription = await updateStatusWithClient(
              client,
              body.external_id,
              'expired',
              { expired_at: new Date() }
            );

            if (!subscription) {
              // FIX-31: distinguish 404 (not found) from 409 (invalid transition)
              await client.query('ROLLBACK');
              const existing = await findByExternalId(body.external_id);

              if (!existing) {
                request.log.warn({
                  event: 'subscription_webhook_not_found',
                  event_type: body.event_type,
                  external_id: body.external_id,
                });
                return reply.status(404).send({
                  error: 'Subscription not found',
                  external_id: body.external_id,
                });
              }

              request.log.warn({
                event: 'subscription_webhook_invalid_transition',
                event_type: body.event_type,
                external_id: body.external_id,
                current_status: existing.status,
              });
              return reply.status(409).send({
                error: 'Invalid status transition',
                external_id: body.external_id,
                current_status: existing.status,
                attempted_status: 'expired',
              });
            }

            await insertEventInTransaction(
              client,
              'subscription_expired',
              {
                subscription_id: subscription.id,
                external_id: subscription.external_id,
                user_id: subscription.user_id,
                plan_slug: subscription.plan_slug,
                expired_at: subscription.expired_at,
              },
              'subscription'
            );
            break;
          }

          case 'subscription.payment_failed': {
            // FIX-32: pre-check subscription exists before emitting event
            const existing = await findByExternalId(body.external_id);
            if (!existing) {
              await client.query('ROLLBACK');
              request.log.warn({
                event: 'subscription_payment_failed_not_found',
                external_id: body.external_id,
              });
              return reply.status(404).send({
                error: 'Subscription not found',
                external_id: body.external_id,
              });
            }

            subscription = existing;

            await insertEventInTransaction(
              client,
              'subscription_payment_failed',
              {
                subscription_id: existing.id,
                external_id: body.external_id,
                plan_slug: body.plan_slug,
                provider: body.provider,
                amount_cents: body.amount_cents,
                metadata: body.metadata,
              },
              'subscription'
            );
            break;
          }
        }

        // Audit log
        if (subscription) {
          await insertAuditInTransaction(
            client,
            `subscription_webhook_${body.event_type}`,
            'subscription',
            subscription.id ?? 'unknown',
            null,
            { event_type: body.event_type, provider: body.provider }
          );
        }

        await client.query('COMMIT');
        return reply.status(200).send({ subscription });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'subscription_webhook_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // GET /subscriptions/plans - public endpoint for available plans
  fastify.get(
    '/subscriptions/plans',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<{
        slug: string;
        name: string;
        description: string | null;
        price_cents: number;
        currency: string;
        billing_cycle: string;
      }>(
        `SELECT slug, name, description, price_cents, currency, billing_cycle
         FROM subscription.plans
         WHERE is_active = TRUE
         ORDER BY price_cents`,
        []
      );

      return ok(reply, { plans: result.rows });
    }
  );
}