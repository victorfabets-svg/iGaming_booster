import { FastifyInstance } from 'fastify';
import { findAllEvents } from '../../shared/events/event.repository';

export async function eventRoutes(fastify: FastifyInstance): Promise<void> {
  // Get all events (last 50, sorted by timestamp DESC)
  fastify.get('/events', async () => {
    const events = await findAllEvents(50);
    return events;
  });
}