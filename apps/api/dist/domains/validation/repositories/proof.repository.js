"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProof = createProof;
exports.findProofByHash = findProofByHash;
exports.findProofById = findProofById;
exports.findAllProofs = findAllProofs;
const database_1 = require("../../../lib/database");
async function createProof(input) {
    const result = await database_1.pool.query(`INSERT INTO validation.proofs (user_id, file_url, hash)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, file_url, hash, submitted_at`, [input.user_id, input.file_url, input.hash]);
    return result.rows[0];
}
async function findProofByHash(hash) {
    return await (0, database_1.queryOne)(`SELECT id, user_id, file_url, hash, submitted_at 
     FROM validation.proofs 
     WHERE hash = $1`, [hash]);
}
async function findProofById(id) {
    return await (0, database_1.queryOne)(`SELECT id, user_id, file_url, hash, submitted_at 
     FROM validation.proofs 
     WHERE id = $1`, [id]);
}
async function findAllProofs(limit = 50) {
    const result = await database_1.pool.query(`SELECT id, user_id, file_url, hash, submitted_at 
     FROM validation.proofs 
     ORDER BY submitted_at DESC
     LIMIT $1`, [limit]);
    return result.rows;
}
//# sourceMappingURL=proof.repository.js.map