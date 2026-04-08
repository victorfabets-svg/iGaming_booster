import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../../../shared/database/connection';
import { proofRoutes } from './routes/proofs';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // Register routes
  app.register(proofRoutes);

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.get('/health/db', async () => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error' };
    }
  });

  return app;
}