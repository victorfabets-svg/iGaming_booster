import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from 'shared/database/connection';
import { randomUUID } from 'crypto';
import { ok, fail } from '../utils/response';

interface RegisterBody {
  email: string;
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
      const { email } = request.body;

      if (!isValidEmail(email)) {
        return fail(reply, 'Valid email required', 'VALIDATION_ERROR');
      }

      const userId = randomUUID();

      try {
        await db.query(
          `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW())`,
          [userId, email]
        );

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