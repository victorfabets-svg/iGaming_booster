/**
 * Admin WhatsApp Routes
 * Admin endpoints for managing WhatsApp subscribers (JWT auth required)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import {
  findById,
  findByPhoneNumber,
  insertWithClient,
  optOutWithClient,
  listAll,
  SubscriberInput,
  SubscriberFilters,
} from '../../domains/whatsapp/subscribers.repository';
import {
  listAll as listDeliveries,
  DeliveryFilters,
} from '../../domains/whatsapp/deliveries.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { db } from '@shared/database/connection';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// E.164 regex for phone validation: ^+[1-9]\d{1,14}$
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

interface ListQuery {
  status?: 'active' | 'opted_out' | 'all';
  since?: string;
  limit?: string;
}

interface GetParams {
  id: string;
}

interface OptOutBody {
  reason: string;
}

interface CreateBody {
  user_id?: string;
  phone_number: string;
  tier?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

interface DeliveryListQuery {
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  since?: string;
  limit?: string;
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
 * Validate subscriber body
 */
function validateSubscriberBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  if (!b.phone_number || typeof b.phone_number !== 'string') {
    return 'phone_number is required and must be a non-empty string';
  }

  if (!E164_REGEX.test(b.phone_number)) {
    return 'phone_number must be in E.164 format (e.g., +5511999999999)';
  }

  return null;
}

export async function adminWhatsappRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // POST /admin/whatsapp/subscribers - Create a new subscriber
  fastify.post<{ Body: CreateBody }>(
    '/admin/whatsapp/subscribers',
    { preHandler: authMiddleware },
    async (
      request: FastifyRequest<{ Body: CreateBody }>,
      reply: FastifyReply
    ) => {
      const validationError = validateSubscriberBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const input: SubscriberInput = {
          user_id: body.user_id,
          phone_number: body.phone_number,
          tier: body.tier,
          language: body.language,
          metadata: body.metadata ?? {},
        };

        const subscriber = await insertWithClient(client, input);

        if (!subscriber) {
          // Conflict: already exists, rollback and fetch existing
          await client.query('ROLLBACK');
          const existing = await findByPhoneNumber(body.phone_number);
          if (existing) {
            return reply.status(200).send({ subscriber: existing });
          }
          return reply.status(500).send({ error: 'Failed to create subscriber' });
        }

        await insertEventInTransaction(
          client,
          'whatsapp_subscriber_registered',
          {
            subscriber_id: subscriber.id,
            phone_number: subscriber.phone_number,
            tier: subscriber.tier,
            language: subscriber.language,
          },
          'whatsapp'
        );

        await insertAuditInTransaction(
          client,
          'whatsapp_subscriber_created',
          'whatsapp',
          subscriber.id,
          null,
          { phone_number: subscriber.phone_number, tier: subscriber.tier }
        );

        await client.query('COMMIT');
        return reply.status(201).send({ subscriber });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'whatsapp_subscriber_create_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // GET /admin/whatsapp/subscribers - List subscribers with filters
  fastify.get<{ Querystring: ListQuery }>(
    '/admin/whatsapp/subscribers',
    { preHandler: authMiddleware },
    async (
      request: FastifyRequest<{ Querystring: ListQuery }>,
      reply: FastifyReply
    ) => {
      const { status, since, limit: limitStr } = request.query;

      // Validate and cap limit
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

      // Build filters
      const filters: SubscriberFilters = {};
      if (status) {
        if (!['active', 'opted_out', 'all'].includes(status)) {
          return reply.status(400).send({ error: 'Invalid status filter' });
        }
        filters.status = status;
      }

      if (since) {
        const sinceDate = parseIsoTimestamp(since);
        if (sinceDate === null) {
          return reply.status(400).send({ error: 'Invalid since timestamp' });
        }
        filters.since = sinceDate;
      }

      const subscribers = await listAll(filters, limit);
      return reply.status(200).send({ subscribers });
    }
  );

  // GET /admin/whatsapp/subscribers/:id - Get a single subscriber
  fastify.get<{ Params: GetParams }>(
    '/admin/whatsapp/subscribers/:id',
    { preHandler: authMiddleware },
    async (
      request: FastifyRequest<{ Params: GetParams }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return reply.status(400).send({ error: 'Invalid subscriber ID format' });
      }

      const subscriber = await findById(id);
      if (!subscriber) {
        return reply.status(404).send({ error: 'Subscriber not found' });
      }

      return reply.status(200).send({ subscriber });
    }
  );

  // POST /admin/whatsapp/subscribers/:id/opt-out - Opt-out a subscriber
  fastify.post<{ Params: GetParams; Body: OptOutBody }>(
    '/admin/whatsapp/subscribers/:id/opt-out',
    { preHandler: authMiddleware },
    async (
      request: FastifyRequest<{ Params: GetParams; Body: OptOutBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { reason } = request.body;

      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return reply.status(400).send({ error: 'Invalid subscriber ID format' });
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return reply.status(400).send({ error: 'reason is required and must be non-empty' });
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const subscriber = await optOutWithClient(client, id, reason);

        if (!subscriber) {
          // Either not found or already opted out
          await client.query('ROLLBACK');
          const existing = await findById(id);
          if (!existing) {
            return reply.status(404).send({ error: 'Subscriber not found' });
          }
          // Already opted out - idempotent return
          return reply.status(200).send({ subscriber: existing });
        }

        await insertEventInTransaction(
          client,
          'whatsapp_subscriber_opted_out',
          {
            subscriber_id: subscriber.id,
            phone_number: subscriber.phone_number,
            opt_out_reason: subscriber.opt_out_reason,
          },
          'whatsapp'
        );

        await insertAuditInTransaction(
          client,
          'whatsapp_subscriber_opted_out',
          'whatsapp',
          subscriber.id,
          null,
          { opt_out_reason: reason }
        );

        await client.query('COMMIT');
        return reply.status(200).send({ subscriber });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'whatsapp_optout_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // GET /admin/whatsapp/deliveries - List deliveries with filters
  fastify.get<{ Querystring: DeliveryListQuery }>(
    '/admin/whatsapp/deliveries',
    { preHandler: authMiddleware },
    async (
      request: FastifyRequest<{ Querystring: DeliveryListQuery }>,
      reply: FastifyReply
    ) => {
      const { status, since, limit: limitStr } = request.query;

      // Validate and cap limit
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

      // Build filters
      const filters: DeliveryFilters = {};
      if (status) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(status)) {
          return reply.status(400).send({ error: 'Invalid status filter' });
        }
        filters.status = status;
      }

      if (since) {
        const sinceDate = parseIsoTimestamp(since);
        if (sinceDate === null) {
          return reply.status(400).send({ error: 'Invalid since timestamp' });
        }
        filters.since = sinceDate;
      }

      const deliveries = await listDeliveries(filters, limit);
      return reply.status(200).send({ deliveries });
    }
  );
}