import { FastifyInstance } from 'fastify';
import { findAllRewards, findRewardById } from '../../../domains/rewards/repositories/reward.repository';
import { findRaffleById, findActiveRaffle, findAllRaffles } from '../../../domains/rewards/repositories/raffle.repository';

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

  // Get all raffles
  fastify.get('/raffles', async () => {
    const raffles = await findAllRaffles();
    return raffles;
  });

  // Get raffle by ID
  fastify.get('/raffles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await findRaffleById(id);
    if (!raffle) {
      return reply.status(404).send({ error: 'Raffle not found' });
    }
    return raffle;
  });

  // Get active raffle
  fastify.get('/raffles/active', async () => {
    const raffle = await findActiveRaffle();
    if (!raffle) {
      return { message: 'No active raffle' };
    }
    return raffle;
  });
}