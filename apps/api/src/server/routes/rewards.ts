import { FastifyInstance } from 'fastify';
import { findAllRewards, findRewardById } from '../../domains/rewards/repositories/reward.repository';

export async function rewardRoutes(fastify: FastifyInstance): Promise<void> {
  // Get all rewards
  fastify.get('/rewards', async () => {
    const rewards = await findAllRewards();
    return rewards;
  });

  // Get reward by ID
  fastify.get('/rewards/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reward = await findRewardById(id);
    if (!reward) {
      return reply.status(404).send({ error: 'Reward not found' });
    }
    return reward;
  });
}