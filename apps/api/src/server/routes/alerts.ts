import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { evaluateAlerts } from '../../domains/observability/services/alerts.service';
import { fail } from '../utils/response';

export async function alertsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    if (!userId) {
      return fail(reply, 'Unauthorized', 'UNAUTHORIZED');
    }
    const report = await evaluateAlerts();
    return reply.send(report);
  });
}