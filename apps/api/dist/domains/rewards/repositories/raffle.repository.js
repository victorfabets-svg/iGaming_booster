"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRaffleById = findRaffleById;
exports.findActiveRaffle = findActiveRaffle;
exports.createRaffle = createRaffle;
exports.updateRaffleStatus = updateRaffleStatus;
exports.findAllRaffles = findAllRaffles;
const database_1 = require("../../../lib/database");
async function findRaffleById(id) {
    return await (0, database_1.queryOne)(`SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE id = $1`, [id]);
}
async function findActiveRaffle() {
    return await (0, database_1.queryOne)(`SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE status = 'active'
     AND draw_date > NOW()
     ORDER BY draw_date ASC
     LIMIT 1`);
}
async function createRaffle(input) {
    const result = await database_1.pool.query(`INSERT INTO raffles.raffles (name, prize, total_numbers, draw_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, prize, total_numbers, draw_date, status`, [input.name, input.prize, input.total_numbers, input.draw_date, input.status]);
    return result.rows[0];
}
async function updateRaffleStatus(id, status) {
    await database_1.pool.query(`UPDATE raffles.raffles SET status = $1 WHERE id = $2`, [status, id]);
}
async function findAllRaffles() {
    const result = await database_1.pool.query(`SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     ORDER BY draw_date DESC`);
    return result.rows;
}
//# sourceMappingURL=raffle.repository.js.map