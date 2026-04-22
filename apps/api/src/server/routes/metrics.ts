import { FastifyInstance } from 'fastify';
import { getQueueSize, getDlqSize } from '../../../../shared/events/event-consumer.repository';
import { ok } from '../utils/response';

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  // Get queue and DLQ metrics
  fastify.get('/metrics', async (request, reply) => {
    const queue_size = await getQueueSize();
    const dlq_size = await getDlqSize();
    return ok(reply, {
      queue_size,
      dlq_size,
      timestamp: Date.now()
    });
  });
}