import { FastifyInstance } from 'fastify';
import { db } from 'shared/database/connection';

/**
 * Health check routes - no auth required
 * /health - simple liveness probe
 * /ready - readiness probe with DB check
 */
export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Simple liveness - always returns ok
  app.get('/health', async (request, reply) => {
    return reply.send({
      success: true,
      data: { status: 'ok' },
      error: null,
    });
  });

  // Readiness - checks DB connectivity with actual query
  app.get('/ready', async (request, reply) => {
    try {
      // Execute actual DB query to verify connectivity
      await db.query('SELECT 1');

      return reply.send({
        success: true,
        data: { status: 'ready' },
        error: null,
      });
    } catch {
      return reply.status(503).send({
        success: false,
        data: null,
        error: { message: 'Not ready', code: 'NOT_READY' },
      });
    }
  });
}