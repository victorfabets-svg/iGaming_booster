import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyJwt from '@fastify/jwt';
import crypto from 'crypto';
import { getDb, db as dbConn } from '../../../../shared/database/connection';
import { getDbHealth } from './state';
import { NEON_DB_URL } from '../../../../shared/config/env';
import { proofRoutes } from './routes/proofs';
import { metricsRoutes } from './routes/metrics';
import healthRoutes from './routes/health';
import { cleanupIdempotency } from './utils/idempotency';
import { requestIdMiddleware } from './middleware/request-id';
import { mapError } from './utils/error-mapper';

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

  // Register request ID middleware for tracing (before routes)
  await app.register(requestIdMiddleware);

  // Register routes
  app.register(proofRoutes);
  app.register(metricsRoutes);
  app.register(healthRoutes);

  // Global error handler - catches all unhandled errors and logs with context
  app.setErrorHandler((err, request, reply) => {
    const mapped = mapError(err);

    request.logger.error({
      event: 'unhandled_error',
      error_type: mapped.type,
      error_code: mapped.code,
      message: err.message,
      stack: err.stack,
      request_id: request.id
    });

    return reply.status(500).send({
      success: false,
      data: null,
      error: {
        message: mapped.message,
        code: mapped.code
      }
    });
  });

  // Cleanup old idempotency keys on startup (24h retention)
  cleanupIdempotency(24 * 60 * 60 * 1000).catch(() => {});

  // DB Health check - for internal monitoring (DB not required)
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