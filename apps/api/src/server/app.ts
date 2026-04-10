import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { db } from '../../../../shared/database/connection';
import { proofRoutes } from './routes/proofs';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // Register multipart plugin for file uploads
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
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