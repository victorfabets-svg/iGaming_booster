import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyJwt from '@fastify/jwt';
import crypto from 'crypto';
import { getDb, db as dbConn } from '../../../../shared/database/connection';
import { getDbHealth } from './state';
import { NEON_DB_URL } from '../../../../shared/config/env';
import { proofRoutes } from './routes/proofs';
import { metricsRoutes } from './routes/metrics';

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
  app.register(metricsRoutes);

  // Health check - always returns ok (DB not required)
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // DB Health check - always returns ok (DB not required)
  app.get('/health/db', async (req, reply) => {
    const internal = req.headers["x-internal-check"] === "true";

    const dbHealthy = getDbHealth();
    const status = dbHealthy ? 'ok' : 'degraded';

    // Canonical JSON serializer for deterministic signing
    const canonical = (obj: Record<string, unknown>) =>
      JSON.stringify(
        Object.keys(obj).sort().reduce((acc, k) => {
          acc[k] = obj[k];
          return acc;
        }, {} as Record<string, unknown>)
      );

    // Build payload with timestamp and request context
    const payload: Record<string, unknown> = {
      status,
      ts: Date.now(),
      method: req.method,
      path: req.url
    };

    // Add dbHost only for internal checks
    if (internal && NEON_DB_URL) {
      try {
        payload.dbHost = new URL(NEON_DB_URL).hostname;
      } catch {
        payload.dbHost = 'unknown';
      }
    }

    // Sign response for internal checks with CANARY_TOKEN (anti-spoof + anti-replay)
    if (internal && process.env.CANARY_TOKEN) {
      const nonce = crypto.randomBytes(8).toString('hex');
      const body = canonical(payload) + nonce;

      const sig = crypto
        .createHmac('sha256', process.env.CANARY_TOKEN)
        .update(body)
        .digest('hex');

      reply.header('x-canary-signature', sig);
      reply.header('x-canary-nonce', nonce);
    }

    // Public: only status. Internal: full visibility.
    return reply.send(payload);
  });

  return app;
}