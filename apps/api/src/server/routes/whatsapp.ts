/**
 * WhatsApp Platform Routes
 * Webhook endpoints for WhatsApp platform to poll and submit delivery status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { whatsappAuthMiddleware } from '../middleware/whatsapp-auth';
import {
  listPendingForDelivery,
  listSettledForNotification,
} from '../../domains/tipster/tips.repository';
import {
  listActive,
  findById as findSubscriberById,
} from '../../domains/whatsapp/subscribers.repository';
import {
  upsertWithClient,
  DeliveryInput,
} from '../../domains/whatsapp/deliveries.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { db } from '@shared/database/connection';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QueueQuery {
  since: string;
  limit?: string;
}

interface SubscribersQuery {
  since?: string;
  limit?: string;
}

interface DeliveryStatusBody {
  tip_id?: string;
  subscriber_id: string;
  message_type: 'tip_alert' | 'settlement_alert';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
  error_code?: string;
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
 * Validate queue query parameters
 */
function validateQueueQuery(query: unknown): string | null {
  if (!query || typeof query !== 'object') {
    return 'Invalid query parameters';
  }

  const q = query as Record<string, unknown>;

  if (!q.since || typeof q.since !== 'string') {
    return 'since is required and must be an ISO timestamp string';
  }

  if (parseIsoTimestamp(q.since) === null) {
    return 'since must be a valid ISO timestamp';
  }

  if (q.limit !== undefined) {
    if (typeof q.limit !== 'string') {
      return 'limit must be a string';
    }
    const parsed = parseInt(q.limit, 10);
    if (isNaN(parsed) || parsed < 1) {
      return 'limit must be a positive integer';
    }
    if (parsed > MAX_LIMIT) {
      return `limit must be at most ${MAX_LIMIT}`;
    }
  }

  return null;
}

/**
 * Validate delivery status body
 */
function validateDeliveryBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  if (typeof b.subscriber_id !== 'string' || !b.subscriber_id) {
    return 'subscriber_id is required and must be a non-empty string';
  }

  // FIX-28: UUID validation for subscriber_id
  if (!UUID_REGEX.test(b.subscriber_id)) {
    return 'subscriber_id must be a valid UUID';
  }

  // tip_id is optional, but if provided must be a valid UUID
  if (b.tip_id !== undefined) {
    if (typeof b.tip_id !== 'string' || !UUID_REGEX.test(b.tip_id)) {
      return 'tip_id must be a valid UUID if provided';
    }
  }

  const validMessageTypes = ['tip_alert', 'settlement_alert'];
  if (!validMessageTypes.includes(b.message_type as string)) {
    return `message_type must be one of: ${validMessageTypes.join(', ')}`;
  }

  const validStatuses = ['sent', 'delivered', 'read', 'failed'];
  if (!validStatuses.includes(b.status as string)) {
    return `status must be one of: ${validStatuses.join(', ')}`;
  }

  if (!b.sent_at || typeof b.sent_at !== 'string' || parseIsoTimestamp(b.sent_at) === null) {
    return 'sent_at is required and must be a valid ISO timestamp';
  }

  // FIX-26: error_code is now required, not recommended
  if (b.status === 'failed' && (!b.error_code || typeof b.error_code !== 'string' || !b.error_code.trim())) {
    return 'error_code is required when status is failed';
  }

  return null;
}

export async function whatsappRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /whatsapp/queue/tips-pending-delivery
  // Returns tips with status='pending' and event_starts_at > NOW() created after since
  fastify.get<{ Querystring: QueueQuery }>(
    '/whatsapp/queue/tips-pending-delivery',
    { preHandler: whatsappAuthMiddleware },
    async (
      request: FastifyRequest<{ Querystring: QueueQuery }>,
      reply: FastifyReply
    ) => {
      const validationError = validateQueueQuery(request.query);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const { since } = request.query;
      const limitStr = request.query.limit;
      const limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_LIMIT;
      const sinceDate = parseIsoTimestamp(since)!;

      const tips = await listPendingForDelivery(sinceDate, limit);
      return reply.status(200).send({ tips });
    }
  );

  // GET /whatsapp/queue/settlements-pending-notification
  // Returns tips with status in (won,lost,void) settled after since
  fastify.get<{ Querystring: QueueQuery }>(
    '/whatsapp/queue/settlements-pending-notification',
    { preHandler: whatsappAuthMiddleware },
    async (
      request: FastifyRequest<{ Querystring: QueueQuery }>,
      reply: FastifyReply
    ) => {
      const validationError = validateQueueQuery(request.query);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const { since } = request.query;
      const limitStr = request.query.limit;
      const limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_LIMIT;
      const sinceDate = parseIsoTimestamp(since)!;

      const tips = await listSettledForNotification(sinceDate, limit);
      return reply.status(200).send({ tips });
    }
  );

  // GET /whatsapp/subscribers
  // Returns active subscribers, optionally filtered by since
  fastify.get<{ Querystring: SubscribersQuery }>(
    '/whatsapp/subscribers',
    { preHandler: whatsappAuthMiddleware },
    async (
      request: FastifyRequest<{ Querystring: SubscribersQuery }>,
      reply: FastifyReply
    ) => {
      const { since } = request.query;
      const limitStr = request.query.limit;

      let limit = DEFAULT_LIMIT;
      if (limitStr) {
        const parsed = parseInt(limitStr, 10);
        if (isNaN(parsed) || parsed < 1) {
          return reply.status(400).send({ error: 'limit must be a positive integer' });
        }
        if (parsed > MAX_LIMIT) {
          return reply.status(400).send({ error: `limit must be at most ${MAX_LIMIT}` });
        }
        limit = parsed;
      }

      const sinceDate = since ? parseIsoTimestamp(since) : undefined;

      const subscribers = await listActive(
        sinceDate ? { since: sinceDate } : undefined,
        limit
      );
      return reply.status(200).send({ subscribers });
    }
  );

  // POST /whatsapp/delivery-status
  // Upsert delivery status (idempotent)
  fastify.post<{ Body: DeliveryStatusBody }>(
    '/whatsapp/delivery-status',
    { preHandler: whatsappAuthMiddleware },
    async (
      request: FastifyRequest<{ Body: DeliveryStatusBody }>,
      reply: FastifyReply
    ) => {
      const validationError = validateDeliveryBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;

      // FIX-27: Pre-check subscriber exists (avoids FK violation → 500)
      const subscriber = await findSubscriberById(body.subscriber_id);
      if (!subscriber) {
        return reply.status(404).send({ error: 'subscriber not found' });
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const input: DeliveryInput = {
          tip_id: body.tip_id,
          subscriber_id: body.subscriber_id,
          message_type: body.message_type,
          status: body.status,
          sent_at: parseIsoTimestamp(body.sent_at)!,
          error_code: body.error_code,
          metadata: body.metadata ?? {},
        };

        const delivery = await upsertWithClient(client, input);

        await insertEventInTransaction(
          client,
          'whatsapp_delivery_recorded',
          {
            delivery_id: delivery.id,
            tip_id: delivery.tip_id,
            subscriber_id: delivery.subscriber_id,
            message_type: delivery.message_type,
            status: delivery.status,
            error_code: delivery.error_code,
          },
          'whatsapp'
        );

        await insertAuditInTransaction(
          client,
          'whatsapp_delivery_recorded',
          'whatsapp',
          delivery.id,
          null,
          { subscriber_id: body.subscriber_id, status: body.status }
        );

        await client.query('COMMIT');
        return reply.status(200).send({ delivery });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'whatsapp_delivery_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );
}