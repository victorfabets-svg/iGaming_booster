import { FastifyInstance } from 'fastify';
import { findAllRewards, findRewardById } from '../../domains/rewards/repositories/reward.repository';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { ok, fail } from '../utils/response';

export async function rewardRoutes(fastify: FastifyInstance): Promise<void> {
  // Require authentication for all reward endpoints
  fastify.addHook('preHandler', authMiddleware);
  // Get all rewards
  fastify.get('/rewards', async (request, reply) => {
    const rewards = await findAllRewards();
    return ok(reply, rewards);
  });

  // Get reward by ID
  fastify.get('/rewards/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reward = await findRewardById(id);
    if (!reward) {
      return fail(reply, 'Reward not found', 'NOT_FOUND');
    }
    return ok(reply, reward);
  });
}