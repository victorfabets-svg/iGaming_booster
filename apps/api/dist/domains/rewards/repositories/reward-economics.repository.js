"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRewardEconomics = createRewardEconomics;
exports.findRewardEconomicsByRewardId = findRewardEconomicsByRewardId;
exports.getTotalEconomics = getTotalEconomics;
const database_1 = require("../../../lib/database");
async function createRewardEconomics(input) {
    const margin = input.estimated_revenue - input.cost;
    const result = await database_1.pool.query(`INSERT INTO rewards.reward_economics (reward_id, cost, estimated_revenue, margin)
     VALUES ($1, $2, $3, $4)
     RETURNING id, reward_id, cost, estimated_revenue, margin, created_at`, [input.reward_id, input.cost, input.estimated_revenue, margin]);
    return result.rows[0];
}
async function findRewardEconomicsByRewardId(rewardId) {
    return await (0, database_1.queryOne)(`SELECT id, reward_id, cost, estimated_revenue, margin, created_at
     FROM rewards.reward_economics
     WHERE reward_id = $1`, [rewardId]);
}
async function getTotalEconomics() {
    const result = await database_1.pool.query(`SELECT 
       COALESCE(SUM(cost), 0) as total_cost,
       COALESCE(SUM(estimated_revenue), 0) as total_revenue,
       COALESCE(SUM(margin), 0) as total_margin,
       COUNT(*) as reward_count
     FROM rewards.reward_economics`);
    return {
        total_cost: parseFloat(result.rows[0].total_cost),
        total_revenue: parseFloat(result.rows[0].total_revenue),
        total_margin: parseFloat(result.rows[0].total_margin),
        reward_count: parseInt(result.rows[0].reward_count, 10),
    };
}
//# sourceMappingURL=reward-economics.repository.js.map