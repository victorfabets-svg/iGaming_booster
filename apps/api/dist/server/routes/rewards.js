"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardRoutes = rewardRoutes;
const reward_repository_1 = require("../../domains/rewards/repositories/reward.repository");
const raffle_repository_1 = require("../../domains/rewards/repositories/raffle.repository");
async function rewardRoutes(fastify) {
    // Get all rewards
    fastify.get('/rewards', async () => {
        const rewards = await (0, reward_repository_1.findAllRewards)();
        return rewards;
    });
    // Get reward by ID
    fastify.get('/rewards/:id', async (request, reply) => {
        const { id } = request.params;
        const reward = await (0, reward_repository_1.findRewardById)(id);
        if (!reward) {
            return reply.status(404).send({ error: 'Reward not found' });
        }
        return reward;
    });
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
}
//# sourceMappingURL=rewards.js.map