import { FastifyReply } from 'fastify';
import { fail } from './response';

/**
 * Enforce ownership check - ensures user can only access their own resources
 * @param reply - Fastify reply instance
 * @param resourceUserId - The user_id stored on the resource
 * @param currentUserId - The current authenticated user's ID from request
 * @returns true if access denied, false if allowed
 */
export function enforceOwnership(
  reply: FastifyReply,
  resourceUserId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  // Handle null/undefined cases
  if (!resourceUserId || !currentUserId) {
    fail(reply, 'Forbidden', 'FORBIDDEN');
    return true;
  }

  if (resourceUserId !== currentUserId) {
    fail(reply, 'Forbidden', 'FORBIDDEN');
    return true;
  }

  return false;
}