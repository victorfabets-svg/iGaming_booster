"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFraudScore = createFraudScore;
exports.findFraudScoreByProofId = findFraudScoreByProofId;
const database_1 = require("../../../lib/database");
async function createFraudScore(input) {
    const result = await database_1.pool.query(`INSERT INTO fraud.fraud_scores (proof_id, score, signals)
     VALUES ($1, $2, $3)
     RETURNING id, proof_id, score, signals, created_at`, [input.proof_id, input.score, JSON.stringify(input.signals)]);
    return result.rows[0];
}
async function findFraudScoreByProofId(proofId) {
    return await (0, database_1.queryOne)(`SELECT id, proof_id, score, signals, created_at 
     FROM fraud.fraud_scores 
     WHERE proof_id = $1`, [proofId]);
}
//# sourceMappingURL=fraud-score.repository.js.map