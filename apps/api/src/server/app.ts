import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyJwt from '@fastify/jwt';
import { db } from '../../../../shared/database/connection';
import { proofRoutes } from './routes/proofs';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // Register JWT plugin for authentication
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });

  // Register multipart plugin for file uploads
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });

  // Register routes
  app.register(proofRoutes);

  // Health check - MUST reflect real DB state
  app.get('/health', async () => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error' };
    }
  });

  return app;
}