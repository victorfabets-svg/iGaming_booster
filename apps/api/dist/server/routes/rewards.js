"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewardRoutes = rewardRoutes;
const reward_repository_1 = require("../../domains/rewards/repositories/reward.repository");
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
}
//# sourceMappingURL=rewards.js.map