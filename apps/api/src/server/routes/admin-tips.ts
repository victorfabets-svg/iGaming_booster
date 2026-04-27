/**
 * Admin Tips Routes
 * Admin endpoints for querying tips (admin role required)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { listAll, findByExternalId, TipFilters } from '../../domains/tipster/tips.repository';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

interface ListQuery {
  status?: 'pending' | 'won' | 'lost' | 'void';
  house_slug?: string;
  since?: string;
  until?: string;
  limit?: string;
}

interface GetParams {
  external_id: string;
}

export async function adminTipsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /admin/tips - List tips with filters
  fastify.get<{ Querystring: ListQuery }>(
    '/admin/tips',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      const { status, house_slug, since, until, limit: limitStr } = request.query;

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
      const filters: TipFilters = {};
      if (status) {
        if (!['pending', 'won', 'lost', 'void'].includes(status)) {
          return reply.status(400).send({ error: 'status must be one of: pending, won, lost, void' });
        }
        filters.status = status;
      }
      if (house_slug) {
        filters.house_slug = house_slug;
      }
      if (since) {
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          return reply.status(400).send({ error: 'since must be a valid ISO timestamp' });
        }
        filters.since = sinceDate;
      }
      if (until) {
        const untilDate = new Date(until);
        if (isNaN(untilDate.getTime())) {
          return reply.status(400).send({ error: 'until must be a valid ISO timestamp' });
        }
        filters.until = untilDate;
      }

      const tips = await listAll(filters, limit);
      return reply.send({
        success: true,
        data: {
          tips,
          count: tips.length,
          limit,
        },
      });
    }
  );

  // GET /admin/tips/:external_id - Get single tip by external_id
  fastify.get<{ Params: GetParams }>(
    '/admin/tips/:external_id',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest<{ Params: GetParams }>, reply: FastifyReply) => {
      const { external_id } = request.params;

      const tip = await findByExternalId(external_id);
      if (!tip) {
        return reply.status(404).send({ error: 'Tip not found' });
      }

      return reply.send({
        success: true,
        data: { tip },
      });
    }
  );
}