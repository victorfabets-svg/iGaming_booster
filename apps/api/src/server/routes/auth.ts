import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from 'shared/database/connection';
import { randomUUID } from 'crypto';

interface RegisterBody {
  email: string;
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

      if (!email || !email.includes('@')) {
        return reply.status(400).send({ error: 'Valid email required' });
      }

      const userId = randomUUID();

      try {
        await db.query(
          `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW())`,
          [userId, email]
        );

        return reply.status(201).send({ user_id: userId, email });
      } catch (err: any) {
        if (err.code === '23505') {
          return reply.status(409).send({ error: 'Email already registered' });
        }
        throw err;
      }
    }
  );
}