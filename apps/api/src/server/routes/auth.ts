import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from 'shared/database/connection';
import { randomUUID } from 'crypto';
import { ok, fail } from '../utils/response';
import { requireFields } from '../utils/validation';
import { rateLimitDb } from '../utils/rate-limit-db';
import { checkIdempotency, saveIdempotency, getIdempotencyKey, reserveIdempotency, getIdempotency, completeIdempotency, releaseStaleIdempotency, isIdempotencyStale } from '../utils/idempotency';
import { auditLog } from '../../../shared/events/audit-log';

interface RegisterBody {
  email: string;
  password: string;
}

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

/**
 * Auth routes - public registration endpoint
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Registration - no auth required
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      // Idempotency - reserve key atomically to prevent race conditions
      const idemKey = getIdempotencyKey(request.headers as Record<string, unknown>);
      if (idemKey) {
        const reserve = await reserveIdempotency(idemKey);
        
        if (!reserve.acquired) {
          // Another request got the key - check its status
          const existing = await getIdempotency(idemKey);
          
          if (existing?.status === 'done') {
            // Completed - return cached response
            return ok(reply, existing.response);
          }
          
          // Check if pending is stale (crashed request)
          if (isIdempotencyStale(existing)) {
            // Release stale key and try to re-acquire
            await releaseStaleIdempotency(idemKey);
            const retryReserve = await reserveIdempotency(idemKey);
            if (!retryReserve.acquired) {
              // Another request got it - check again
              const retryExisting = await getIdempotency(idemKey);
              if (retryExisting?.status === 'done') {
                return ok(reply, retryExisting.response);
              }
              return fail(reply, 'Request in progress, please retry', 'IDEMPOTENCY_IN_PROGRESS');
            }
          } else {
            // Still in progress - tell client to retry
            return fail(reply, 'Request in progress, please retry', 'IDEMPOTENCY_IN_PROGRESS');
          }
        }
      }

      // Rate limiting - 5 requests per minute per IP (stored in DB for persistence)
      const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
      const allowed = await rateLimitDb(clientIp, 5, 60000);

      if (!allowed) {
        return fail(reply, 'Too many requests', 'RATE_LIMIT');
      }

      // Validate required fields
      const fieldsError = requireFields(request.body, ['email', 'password']);
      if (fieldsError) {
        return fail(reply, fieldsError, 'VALIDATION_ERROR');
      }

      const { email, password } = request.body;

      // Validate email format
      if (!isValidEmail(email)) {
        return fail(reply, 'Valid email required', 'VALIDATION_ERROR');
      }

      // Validate password strength
      if (password.length < 8) {
        return fail(reply, 'Password must be at least 8 characters', 'VALIDATION_ERROR');
      }

      const userId = randomUUID();

      try {
        await db.query(
          `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW())`,
          [userId, email]
        );

        // Audit log for successful registration
        await auditLog(userId, 'user_registered', { email });

        // Save idempotency key with response (only on success)
        if (idemKey) {
          await completeIdempotency(idemKey, { user_id: userId, email });
        }

        return ok(reply, { user_id: userId, email });
      } catch (err: any) {
        if (err.code === '23505') {
          return fail(reply, 'Email already registered', 'DUPLICATE_EMAIL');
        }
        console.error(err);
        return fail(reply, err.message);
      }
    }
  );
}