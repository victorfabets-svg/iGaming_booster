/**
 * requireAdmin middleware - enforces admin role for protected routes.
 * Runs after authMiddleware. Reads role from request.user (populated by @fastify/jwt).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { ok, fail } from '../../server/utils/response';

/**
 * JWT payload interface with role
 */
export interface JwtPayload {
  sub: string;
  user_id: string;
  role?: string;
}

/**
 * requireAdmin middleware factory
 * @param fastify - Fastify instance for DB access if needed
 */
export function requireAdmin(fastify: FastifyInstance) {
  return async function requireAdminHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Get decoded JWT - @fastify/jwt populates request.user, not request.jwt
      const decoded = (request as any).user as JwtPayload | undefined;
      
      if (!decoded) {
        // Shouldn't happen if authMiddleware ran first, but being defensive
        return reply.status(401).send({ 
          success: false, 
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' } 
        });
      }

      const userId = decoded.user_id || decoded.sub;
      let userRole = decoded.role;

      // Backwards compat: if role not in JWT, fetch from DB
      if (!userRole) {
        try {
          const roleResult = await db.query<{ role: string }>(
            `SELECT role FROM identity.users WHERE id = $1`,
            [userId]
          );
          userRole = roleResult.rows[0]?.role || 'user';
        } catch {
          // DB error - fall back to 'user'
          userRole = 'user';
        }
      }

      if (userRole !== 'admin') {
        return reply.status(403).send({ 
          success: false, 
          error: { code: 'FORBIDDEN', message: 'Admin role required' } 
        });
      }

      // Attach role to request for downstream handlers
      (request as any).userRole = userRole;
    } catch (err) {
      // JWT verification failed (shouldn't happen if authMiddleware ran first)
      return reply.status(401).send({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' } 
      });
    }
  };
}