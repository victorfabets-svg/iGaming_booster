import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FastifyJwtNamespace } from '@fastify/jwt';

/**
 * Auth middleware - extracts user_id from JWT token
 * Zero trust: block all requests without valid token
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Verify JWT token - throws if invalid/missing
    const decoded = request.jwtVerify<{ user_id: string }>();
    
    // Attach user_id to request for use in handlers
    (request as any).userId = (await decoded).user_id;
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized: valid token required' });
  }
}

/**
 * Optional auth - attaches user_id if token present, otherwise null
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = request.jwtVerify<{ user_id: string }>();
    (request as any).userId = (await decoded).user_id;
  } catch {
    (request as any).userId = null;
  }
}