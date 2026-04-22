import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { findAllRewards, findRewardById } from '../../domains/rewards/repositories/reward.repository';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { ok, fail } from '../utils/response';
import { enforceOwnership } from '../utils/ownership';

export async function rewardRoutes(fastify: FastifyInstance): Promise<void> {
  // Require authentication for all reward endpoints
  fastify.addHook('preHandler', authMiddleware);

  // Get all rewards (filter by current user)
  fastify.get('/rewards', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const rewards = await findAllRewards();
    // Filter to only show current user's rewards
    const userRewards = rewards.filter(r => r.user_id === userId);
    return ok(reply, userRewards);
  });

  // Get reward by ID (enforce ownership)
  fastify.get('/rewards/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).userId;
    const reward = await findRewardById(id);
    
    if (!reward) {
      return fail(reply, 'Reward not found', 'NOT_FOUND');
    }

    // Enforce ownership - users can only view their own rewards
    if (enforceOwnership(reply, reward.user_id, userId)) {
      return;
    }

    return ok(reply, reward);
  });
}