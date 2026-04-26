/**
 * Tipster Ingestion Routes
 * Webhook endpoints for receiving tips from Tipster Engine
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tipsterAuthMiddleware } from '../middleware/tipster-auth';
import {
  findByExternalId,
  insertWithClient,
  settleWithClient,
  TipInput,
} from '../../domains/tipster/tips.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { db } from '@shared/database/connection';

interface TipsterTipBody {
  external_id: string;
  sport: string;
  league?: string;
  event_name: string;
  event_starts_at: string;
  market: string;
  selection: string;
  odds: number;
  stake_units: number;
  confidence?: number;
  house_slug?: string;
  tipster_created_at?: string;
  metadata?: Record<string, unknown>;
}

interface SettleBody {
  status: 'won' | 'lost' | 'void';
  settled_value?: number;
  settled_at?: string;
}

/**
 * Validate tipster tip body
 */
function validateTipBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;

  if (typeof b.external_id !== 'string' || !b.external_id) {
    return 'external_id is required and must be non-empty';
  }
  if (typeof b.sport !== 'string' || !b.sport) {
    return 'sport is required and must be non-empty';
  }
  if (typeof b.event_name !== 'string' || !b.event_name) {
    return 'event_name is required and must be non-empty';
  }
  if (typeof b.event_starts_at !== 'string' || !b.event_starts_at) {
    return 'event_starts_at is required and must be a valid ISO timestamp';
  }
  if (typeof b.market !== 'string' || !b.market) {
    return 'market is required and must be non-empty';
  }
  if (typeof b.selection !== 'string' || !b.selection) {
    return 'selection is required and must be non-empty';
  }
  if (typeof b.odds !== 'number' || b.odds <= 1) {
    return 'odds is required and must be a number greater than 1';
  }
  if (typeof b.stake_units !== 'number' || b.stake_units <= 0) {
    return 'stake_units is required and must be a number greater than 0';
  }
  if (b.confidence !== undefined && (typeof b.confidence !== 'number' || !Number.isInteger(b.confidence))) {
    return 'confidence must be an integer if provided';
  }

  return null;
}

/**
 * Validate settle body
 */
function validateSettleBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }

  const b = body as Record<string, unknown>;
  const validStatuses = ['won', 'lost', 'void'];

  if (!validStatuses.includes(b.status as string)) {
    return `status must be one of: ${validStatuses.join(', ')}`;
  }
  if (b.settled_value !== undefined && typeof b.settled_value !== 'number') {
    return 'settled_value must be a number if provided';
  }
  if (b.settled_at !== undefined && typeof b.settled_at !== 'string') {
    return 'settled_at must be a string ISO timestamp if provided';
  }

  return null;
}

export async function tipsterRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // POST /tipster/tips - Ingest a new tip
  fastify.post<{ Body: TipsterTipBody }>(
    '/tipster/tips',
    { preHandler: tipsterAuthMiddleware },
    async (request: FastifyRequest<{ Body: TipsterTipBody }>, reply: FastifyReply) => {
      const validationError = validateTipBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;

      // Idempotency: check if tip already exists
      const existing = await findByExternalId(body.external_id);
      if (existing) {
        return reply.status(200).send({ success: true, data: { tip: existing } });
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const input: TipInput = {
          external_id: body.external_id,
          sport: body.sport,
          league: body.league,
          event_name: body.event_name,
          event_starts_at: new Date(body.event_starts_at),
          market: body.market,
          selection: body.selection,
          odds: body.odds,
          stake_units: body.stake_units,
          confidence: body.confidence,
          house_slug: body.house_slug,
          tipster_created_at: body.tipster_created_at ? new Date(body.tipster_created_at) : null,
          metadata: body.metadata ?? {},
        };

        const tip = await insertWithClient(client, input);

        await insertEventInTransaction(
          client,
          'tip_received',
          {
            tip_id: tip.id,
            external_id: tip.external_id,
            sport: tip.sport,
            event_name: tip.event_name,
            event_starts_at: tip.event_starts_at,
            market: tip.market,
            selection: tip.selection,
            odds: tip.odds,
            stake_units: tip.stake_units,
            house_slug: tip.house_slug,
          },
          'tipster'
        );

        await insertAuditInTransaction(
          client,
          'tip_received',
          'tipster',
          tip.id,
          null,
          { external_id: tip.external_id, sport: tip.sport, market: tip.market }
        );

        await client.query('COMMIT');
        return reply.status(201).send({ success: true, data: { tip } });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'tipster_ingest_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );

  // POST /tipster/tips/:external_id/settle - Settle a tip
  fastify.post<{ Params: { external_id: string }; Body: SettleBody }>(
    '/tipster/tips/:external_id/settle',
    { preHandler: tipsterAuthMiddleware },
    async (
      request: FastifyRequest<{ Params: { external_id: string }; Body: SettleBody }>,
      reply: FastifyReply
    ) => {
      const { external_id } = request.params;

      const validationError = validateSettleBody(request.body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const body = request.body;
      const tip = await findByExternalId(external_id);

      if (!tip) {
        return reply.status(404).send({ error: 'Tip not found' });
      }

      // Idempotent: same status returns 200
      if (tip.status === body.status) {
        return reply.status(200).send({ success: true, data: { tip } });
      }

      // Conflict: already settled with different status
      if (tip.status !== 'pending') {
        return reply.status(409).send({
          error: 'already_settled',
          current_status: tip.status,
        });
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const settledTip = await settleWithClient(
          client,
          external_id,
          body.status,
          body.settled_value,
          body.settled_at ? new Date(body.settled_at) : undefined
        );

        await insertEventInTransaction(
          client,
          'tip_settled',
          {
            tip_id: settledTip.id,
            external_id: settledTip.external_id,
            status: settledTip.status,
            settled_value: settledTip.settled_value,
            settled_at: settledTip.settled_at,
          },
          'tipster'
        );

        await insertAuditInTransaction(
          client,
          'tip_settled',
          'tipster',
          settledTip.id,
          null,
          {
            external_id: settledTip.external_id,
            status: settledTip.status,
            settled_value: settledTip.settled_value,
          }
        );

        await client.query('COMMIT');
        return reply.status(200).send({ success: true, data: { tip: settledTip } });
      } catch (error) {
        await client.query('ROLLBACK');
        request.log.error({ event: 'tipster_settle_error', error });
        return reply.status(500).send({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    }
  );
}