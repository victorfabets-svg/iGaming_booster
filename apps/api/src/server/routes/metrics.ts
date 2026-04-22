import { FastifyInstance } from 'fastify';
import { getQueueSize, getDlqSize } from '../../../../shared/events/event-consumer.repository';

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  // Get queue and DLQ metrics
  fastify.get('/metrics', async () => {
    const queue = await getQueueSize();
    const dlq = await getDlqSize();
    return {
      queue_size: queue,
      dlq_size: dlq,
      timestamp: Date.now()
    };
  });
}