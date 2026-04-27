import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import crypto from 'crypto';
import { getDb, db as dbConn } from '@shared/database/connection';
import { getDbHealth } from './state';
import { NEON_DB_URL } from '@shared/config/env';
import { proofRoutes } from './routes/proofs';
import { authRoutes } from './routes/auth';
import { affiliateRoutes } from './routes/affiliate';
import { metricsRoutes } from './routes/metrics';
import { metricsFunnelRoutes } from './routes/metrics-funnel';
import { alertsRoutes } from './routes/alerts';
import healthRoutes from './routes/health';
import { devRoutes } from './routes/dev';
import { adminPartnerHousesRoutes } from './routes/admin-partner-houses';
import { tipsterRoutes } from './routes/tipster';
import { adminTipsRoutes } from './routes/admin-tips';
import { whatsappRoutes } from './routes/whatsapp';
import { adminWhatsappRoutes } from './routes/admin-whatsapp';
import { subscriptionRoutes } from './routes/subscription';
import { adminSubscriptionRoutes } from './routes/admin-subscription';
import { cleanupIdempotency } from './utils/idempotency';
import { requestIdMiddleware } from './middleware/request-id';
import { mapError } from './utils/error-mapper';
import { CircuitOpenError, DbPoolExhaustedError } from '@shared/database/db-circuit';
import { isCircuitOpen } from '@shared/database/db-circuit';

// Request timeout - prevents hanging requests (10s)
const REQUEST_TIMEOUT_MS = 10000;

// Concurrency control - max in-flight requests
const MAX_CONCURRENT_REQUESTS = 100;
let activeRequests = 0;

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  // Global request timeout + concurrency control
  app.addHook('onRequest', async (request, reply) => {
    // Concurrency check - reject if overloaded
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      request.log.error({
        event: 'server_overloaded',
        active_requests: activeRequests,
        request_id: request.id
      });

      return reply.status(503).send({
        success: false,
        data: null,
        error: {
          message: 'Server overloaded',
          code: 'OVERLOADED'
        }
      });
    }

    // Increment active count
    activeRequests++;

    // Request timeout timer
    const timer = setTimeout(() => {
      request.log.error({
        event: 'request_timeout',
        request_id: request.id,
        path: request.url,
        method: request.method
      });

      // Only send if response not already sent
      if (!reply.sent) {
        reply.status(408).send({
          success: false,
          data: null,
          error: {
            message: 'Request timeout',
            code: 'TIMEOUT'
          }
        });
      }
    }, REQUEST_TIMEOUT_MS);

    // Clear timer and decrement on response finish
    reply.raw.on('finish', () => {
      clearTimeout(timer);
      activeRequests = Math.max(0, activeRequests - 1);
    });
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

  // Register cookie plugin for affiliate tracking
  app.register(fastifyCookie);

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
  app.register(authRoutes);
  app.register(affiliateRoutes);
  app.register(metricsRoutes);
  app.register(metricsFunnelRoutes);
  app.register(alertsRoutes);
  app.register(healthRoutes);
  // Dev routes only registered in development mode (guards inside)
  app.register(devRoutes);
  // Admin routes for partner houses management
  app.register(adminPartnerHousesRoutes);
  // Tipster ingestion routes (webhook)
  app.register(tipsterRoutes);
  // Admin tips routes (JWT auth)
  app.register(adminTipsRoutes);
  // WhatsApp platform routes (API key auth)
  app.register(whatsappRoutes);
  // Admin WhatsApp routes (JWT auth)
  app.register(adminWhatsappRoutes);
  // Subscription webhook routes (API key auth)
  app.register(subscriptionRoutes);
  // Admin subscription routes (JWT auth)
  app.register(adminSubscriptionRoutes);

  // Global error handler - catches all unhandled errors and logs with context
  app.setErrorHandler((err, request, reply) => {
    // Fast fail for circuit open
    if (err instanceof CircuitOpenError) {
      request.log.error({
        event: 'circuit_open',
        request_id: request.id
      });

      return reply.status(503).send({
        success: false,
        data: null,
        error: {
          message: 'Service unavailable',
          code: 'CIRCUIT_OPEN'
        }
      });
    }

    // Fast fail for DB pool exhaustion
    if (err instanceof DbPoolExhaustedError) {
      request.log.error({
        event: 'db_pool_exhausted',
        request_id: request.id
      });

      return reply.status(503).send({
        success: false,
        data: null,
        error: {
          message: 'Database overloaded',
          code: 'DB_POOL_EXHAUSTED'
        }
      });
    }

    const mapped = mapError(err);

    request.log.error({
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
      path: req.url,
      circuitOpen: isCircuitOpen()
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