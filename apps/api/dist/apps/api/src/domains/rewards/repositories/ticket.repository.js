"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
exports.findTicketByRaffleAndNumber = findTicketByRaffleAndNumber;
exports.findTicketsByRewardId = findTicketsByRewardId;
exports.countTicketsByRewardId = countTicketsByRewardId;
exports.findTicketsByRaffleId = findTicketsByRaffleId;
const database_1 = require("../../../lib/database");
async function createTicket(input) {
    const result = await database_1.pool.query(`INSERT INTO rewards.tickets (user_id, raffle_id, number, reward_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (raffle_id, number) DO NOTHING
     RETURNING id, user_id, raffle_id, number, reward_id, created_at`, [input.user_id, input.raffle_id, input.number, input.reward_id]);
    return result.rows[0];
}
async function findTicketByRaffleAndNumber(raffleId, number) {
    const result = await database_1.pool.query(`SELECT id, user_id, raffle_id, number, reward_id, created_at
     FROM rewards.tickets
     WHERE raffle_id = $1 AND number = $2`, [raffleId, number]);
    return result.rows[0] || null;
}
async function findTicketsByRewardId(rewardId) {
    const result = await database_1.pool.query(`SELECT id, user_id, raffle_id, number, reward_id, created_at
     FROM rewards.tickets
     WHERE reward_id = $1`, [rewardId]);
    return result.rows;
}
async function countTicketsByRewardId(rewardId) {
    const result = await database_1.pool.query(`SELECT COUNT(*) as count FROM rewards.tickets WHERE reward_id = $1`, [rewardId]);
    return parseInt(result.rows[0].count, 10);
}
async function findTicketsByRaffleId(raffleId) {
    const result = await database_1.pool.query(`SELECT id, user_id, raffle_id, number, reward_id, created_at
     FROM rewards.tickets
     WHERE raffle_id = $1
     ORDER BY number ASC`, [raffleId]);
    return result.rows;
}
//# sourceMappingURL=ticket.repository.js.map