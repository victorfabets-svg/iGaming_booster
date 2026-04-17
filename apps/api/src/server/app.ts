import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyJwt from '@fastify/jwt';
import { db, getDb } from '../../../../shared/database/connection';
import { NEON_DB_URL } from '../../../../shared/config/env';
import { proofRoutes } from './routes/proofs';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // Register JWT plugin for authentication
  // MUST fail in production if JWT_SECRET not set - no fallback secrets
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  app.register(fastifyJwt, {
    secret: jwtSecret,
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

  // DB Health check - exposes active database host (internal only by default)
  app.get('/health/db', async (req, reply) => {
    const host = new URL(NEON_DB_URL).hostname;
    const internal = req.headers["x-internal-check"] === "true";

    let dbOk = false;

    try {
      const db = getDb();

      // Race query against 500ms timeout
      await Promise.race([
        db.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
      ]);

      dbOk = true;
    } catch {
      dbOk = false;
    }

    // Public: only status. Internal: full visibility.
    return reply.send(
      internal
        ? { status: dbOk ? 'ok' : 'degraded', dbHost: host }
        : { status: dbOk ? 'ok' : 'degraded' }
    );
  });

  return app;
}