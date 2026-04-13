"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReward = createReward;
exports.findRewardByProofId = findRewardByProofId;
exports.findRewardById = findRewardById;
exports.updateRewardStatus = updateRewardStatus;
const database_1 = require("../../../lib/database");
async function createReward(input) {
    const result = await database_1.pool.query(`INSERT INTO rewards.rewards (user_id, proof_id, type, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, proof_id, type, status, created_at`, [input.user_id, input.proof_id, input.type, input.status]);
    return result.rows[0];
}
async function findRewardByProofId(proofId) {
    return await (0, database_1.queryOne)(`SELECT id, user_id, proof_id, type, status, created_at
     FROM rewards.rewards
     WHERE proof_id = $1`, [proofId]);
}
async function findRewardById(id) {
    return await (0, database_1.queryOne)(`SELECT id, user_id, proof_id, type, status, created_at
     FROM rewards.rewards
     WHERE id = $1`, [id]);
}
async function updateRewardStatus(id, status) {
    await database_1.pool.query(`UPDATE rewards.rewards SET status = $1 WHERE id = $2`, [status, id]);
}
//# sourceMappingURL=reward.repository.js.map