import { FastifyInstance } from 'fastify';
import { findRaffleById, findAllRaffles, findActiveRaffle } from '../../domains/rewards/repositories/raffle.repository';
import { findRaffleDrawByRaffleId } from '../../domains/raffles/repositories/raffle-draw.repository';

export async function raffleRoutes(fastify: FastifyInstance): Promise<void> {
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

  // Get raffle result by ID
  fastify.get('/raffles/:id/result', async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await findRaffleById(id);
    if (!raffle) {
      return reply.status(404).send({ error: 'Raffle not found' });
    }

    const draw = await findRaffleDrawByRaffleId(id);
    if (!draw) {
      return reply.status(404).send({ error: 'Raffle draw not found' });
    }

    return {
      raffle_id: raffle.id,
      raffle_name: raffle.name,
      prize: raffle.prize,
      result_number: draw.result_number,
      winner_user_id: draw.winner_user_id,
      winner_ticket_id: draw.winner_ticket_id,
      executed_at: draw.executed_at,
    };
  });
}