"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProofValidation = createProofValidation;
exports.findValidationByProofId = findValidationByProofId;
exports.updateValidationStatus = updateValidationStatus;
exports.findProofById = findProofById;
const database_1 = require("../../../lib/database");
async function createProofValidation(input) {
    const result = await database_1.pool.query(`INSERT INTO validation.proof_validations (proof_id, status, validation_version)
     VALUES ($1, $2, $3)
     RETURNING id, proof_id, status, confidence_score, validation_version, validated_at, created_at`, [input.proof_id, input.status, input.validation_version]);
    return result.rows[0];
}
async function findValidationByProofId(proofId) {
    return await (0, database_1.queryOne)(`SELECT id, proof_id, status, confidence_score, validation_version, validated_at, created_at
     FROM validation.proof_validations
     WHERE proof_id = $1`, [proofId]);
}
async function updateValidationStatus(id, status, confidenceScore) {
    await database_1.pool.query(`UPDATE validation.proof_validations
     SET status = $1, confidence_score = $2, validated_at = NOW()
     WHERE id = $3`, [status, confidenceScore ?? null, id]);
}
async function findProofById(id) {
    return await (0, database_1.queryOne)(`SELECT id, user_id, file_url FROM validation.proofs WHERE id = $1`, [id]);
}
//# sourceMappingURL=proof-validation.repository.js.map