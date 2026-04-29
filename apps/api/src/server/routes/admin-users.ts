/**
 * Admin Routes for User Management
 * 
 * Handles user listing and role changes for admin/affiliate promotion.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { ok, fail } from '../utils/response';

interface UserRow {
  id: string;
  email: string;
  role: string;
  email_verified: boolean;
  display_name: string | null;
  created_at: string;
}

interface UsersQuery {
  role?: string;
  q?: string;
  limit?: string;
}

interface RoleChangeBody {
  role: 'user' | 'admin' | 'affiliate';
}

interface JwtPayload {
  sub: string;
  user_id: string;
  role?: string;
}

/**
 * Admin user routes
 */
export async function adminUserRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /admin/users - List users with optional filters
  fastify.get<{ Querystring: UsersQuery }>(
    '/admin/users',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Querystring: UsersQuery }>,
      reply: FastifyReply
    ) => {
      const { role, q, limit } = request.query;
      
      // Build query
      let queryText = `
        SELECT id, email, role, email_verified, display_name, created_at
        FROM identity.users
        WHERE 1=1
      `;
      const params: unknown[] = [];
      let paramIdx = 1;

      // Filter by role
      if (role && ['user', 'admin', 'affiliate'].includes(role)) {
        queryText += ` AND role = $${paramIdx}`;
        params.push(role);
        paramIdx++;
      }

      // Filter by email search
      if (q) {
        queryText += ` AND email ILIKE $${paramIdx}`;
        params.push(`%${q}%`);
        paramIdx++;
      }

      // Order and limit
      const limitVal = Math.min(parseInt(limit || '50') || 50, 100);
      queryText += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
      params.push(limitVal);

      const result = await db.query<UserRow>(queryText, params);
      
      const users = result.rows.map(row => ({
        id: row.id,
        email: row.email,
        role: row.role,
        email_verified: row.email_verified,
        display_name: row.display_name,
        created_at: row.created_at,
      }));

      return ok(reply, { users });
    }
  );

  // PATCH /admin/users/:id/role - Change user role
  fastify.patch<{ Params: { id: string }; Body: RoleChangeBody }>(
    '/admin/users/:id/role',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: RoleChangeBody }>,
      reply: FastifyReply
    ) => {
      const targetUserId = request.params.id;
      const { role: newRole } = request.body || {};

      // Validate role is in allowed values
      if (!newRole || !['user', 'admin', 'affiliate'].includes(newRole)) {
        return fail(reply, 'Invalid role. Must be user, admin, or affiliate.', 'VALIDATION_ERROR');
      }

      // Get current user ID from JWT (request.user set by authMiddleware)
      const decoded = (request as any).user as JwtPayload | undefined;
      const currentUserId = decoded?.user_id || decoded?.sub;
      
      if (!currentUserId) {
        return fail(reply, 'Unable to identify current user', 'INTERNAL_ERROR');
      }

      // ANTI-LOCKOUT: Cannot change own role
      if (targetUserId === currentUserId) {
        return fail(
          reply,
          'Admin não pode alterar a própria role',
          'FORBIDDEN_SELF_ROLE_CHANGE',
          403
        );
      }

      // Get target user current role
      const targetUserResult = await db.query<{ id: string; role: string }>(
        `SELECT id, role FROM identity.users WHERE id = $1`,
        [targetUserId]
      );

      if (targetUserResult.rows.length === 0) {
        return fail(reply, 'User not found', 'NOT_FOUND', 404);
      }

      const currentRole = targetUserResult.rows[0].role;

      // ANTI-LOCKOUT: Cannot demote the last admin
      if (currentRole === 'admin' && newRole !== 'admin') {
        const adminCountResult = await db.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM identity.users WHERE role = 'admin'`
        );
        const adminCount = parseInt(adminCountResult.rows[0].count) || 0;
        
        if (adminCount === 1) {
          return fail(
            reply,
            'Não é possível remover o último admin do sistema',
            'LAST_ADMIN',
            403
          );
        }
      }

      // Update role
      const updateResult = await db.query<{ id: string; email: string; role: string }>(
        `UPDATE identity.users SET role = $1 WHERE id = $2 RETURNING id, email, role`,
        [newRole, targetUserId]
      );

      if (updateResult.rows.length === 0) {
        return fail(reply, 'Failed to update user role', 'INTERNAL_ERROR');
      }

      const updatedUser = updateResult.rows[0];
      return ok(reply, {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
        }
      });
    }
  );
}