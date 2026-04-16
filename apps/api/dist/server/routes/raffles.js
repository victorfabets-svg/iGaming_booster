"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raffleRoutes = raffleRoutes;
const raffle_repository_1 = require("../../domains/rewards/repositories/raffle.repository");
const raffle_draw_repository_1 = require("../../domains/raffles/repositories/raffle-draw.repository");
async function raffleRoutes(fastify) {
    // Get all raffles
    fastify.get('/raffles', async () => {
        const raffles = await (0, raffle_repository_1.findAllRaffles)();
        return raffles;
    });
    // Get raffle by ID
    fastify.get('/raffles/:id', async (request, reply) => {
        const { id } = request.params;
        const raffle = await (0, raffle_repository_1.findRaffleById)(id);
        if (!raffle) {
            return reply.status(404).send({ error: 'Raffle not found' });
        }
        return raffle;
    });
    // Get active raffle
    fastify.get('/raffles/active', async () => {
        const raffle = await (0, raffle_repository_1.findActiveRaffle)();
        if (!raffle) {
            return { message: 'No active raffle' };
        }
        return raffle;
    });
    // Get raffle result by ID
    fastify.get('/raffles/:id/result', async (request, reply) => {
        const { id } = request.params;
        const raffle = await (0, raffle_repository_1.findRaffleById)(id);
        if (!raffle) {
            return reply.status(404).send({ error: 'Raffle not found' });
        }
        const draw = await (0, raffle_draw_repository_1.findRaffleDrawByRaffleId)(id);
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
//# sourceMappingURL=raffles.js.map