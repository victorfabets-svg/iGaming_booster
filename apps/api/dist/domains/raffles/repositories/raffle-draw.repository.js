"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRaffleDraw = createRaffleDraw;
exports.findRaffleDrawByRaffleId = findRaffleDrawByRaffleId;
exports.updateRaffleDrawWinner = updateRaffleDrawWinner;
exports.markRaffleExecuted = markRaffleExecuted;
const database_1 = require("../../../lib/database");
async function createRaffleDraw(input) {
    const result = await database_1.pool.query(`INSERT INTO raffles.raffle_draws (raffle_id, seed, algorithm, result_number)
     VALUES ($1, $2, $3, $4)
     RETURNING id, raffle_id, seed, algorithm, result_number, winner_user_id, winner_ticket_id, executed_at`, [input.raffle_id, input.seed, input.algorithm, input.result_number]);
    return result.rows[0];
}
async function findRaffleDrawByRaffleId(raffleId) {
    return await (0, database_1.queryOne)(`SELECT id, raffle_id, seed, algorithm, result_number, winner_user_id, winner_ticket_id, executed_at
     FROM raffles.raffle_draws
     WHERE raffle_id = $1`, [raffleId]);
}
async function updateRaffleDrawWinner(drawId, winnerUserId, winnerTicketId) {
    await database_1.pool.query(`UPDATE raffles.raffle_draws 
     SET winner_user_id = $1, winner_ticket_id = $2
     WHERE id = $3`, [winnerUserId, winnerTicketId, drawId]);
}
async function markRaffleExecuted(raffleId) {
    await database_1.pool.query(`UPDATE raffles.raffles 
     SET status = 'executed'
     WHERE id = $1`, [raffleId]);
}
//# sourceMappingURL=raffle-draw.repository.js.map