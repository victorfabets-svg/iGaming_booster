import { FastifyInstance } from 'fastify';
import { findRaffleById, findAllRaffles, findActiveRaffle } from '../../domains/rewards/repositories/raffle.repository';
import { findRaffleDrawByRaffleId } from '../../domains/raffles/repositories/raffle-draw.repository';
import { ok, fail } from '../utils/response';

export async function raffleRoutes(fastify: FastifyInstance): Promise<void> {
  // Get all raffles
  fastify.get('/raffles', async (request, reply) => {
    const raffles = await findAllRaffles();
    return ok(reply, raffles);
  });

  // Get raffle by ID
  fastify.get('/raffles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await findRaffleById(id);
    if (!raffle) {
      return fail(reply, 'Raffle not found', 'NOT_FOUND');
    }
    return ok(reply, raffle);
  });

  // Get active raffle
  fastify.get('/raffles/active', async (request, reply) => {
    const raffle = await findActiveRaffle();
    if (!raffle) {
      return ok(reply, { message: 'No active raffle' });
    }
    return ok(reply, raffle);
  });

  // Get raffle result by ID
  fastify.get('/raffles/:id/result', async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await findRaffleById(id);
    if (!raffle) {
      return fail(reply, 'Raffle not found', 'NOT_FOUND');
    }

    const draw = await findRaffleDrawByRaffleId(id);
    if (!draw) {
      return fail(reply, 'Raffle draw not found', 'NOT_FOUND');
    }

    return ok(reply, {
      raffle_id: raffle.id,
      raffle_name: raffle.name,
      prize: raffle.prize,
      result_number: draw.result_number,
      winner_user_id: draw.winner_user_id,
      winner_ticket_id: draw.winner_ticket_id,
      executed_at: draw.executed_at,
    });
  });
}