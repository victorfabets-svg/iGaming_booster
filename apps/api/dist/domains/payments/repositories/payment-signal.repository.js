"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentSignal = createPaymentSignal;
exports.findPaymentSignalsByProofId = findPaymentSignalsByProofId;
exports.findPaymentSignalByProofAndType = findPaymentSignalByProofAndType;
exports.countPaymentSignalsByProof = countPaymentSignalsByProof;
const database_1 = require("../../../lib/database");
async function createPaymentSignal(input) {
    const result = await database_1.pool.query(`INSERT INTO payments.payment_signals (proof_id, type, value, confidence, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, proof_id, type, value, confidence, metadata, created_at`, [
        input.proof_id,
        input.type,
        input.value,
        input.confidence ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
    ]);
    return result.rows[0];
}
async function findPaymentSignalsByProofId(proofId) {
    return await (0, database_1.query)(`SELECT id, proof_id, type, value, confidence, metadata, created_at
     FROM payments.payment_signals
     WHERE proof_id = $1`, [proofId]);
}
async function findPaymentSignalByProofAndType(proofId, type) {
    const result = await database_1.pool.query(`SELECT id, proof_id, type, value, confidence, metadata, created_at
     FROM payments.payment_signals
     WHERE proof_id = $1 AND type = $2`, [proofId, type]);
    return result.rows[0] || null;
}
async function countPaymentSignalsByProof(proofId) {
    const result = await database_1.pool.query(`SELECT COUNT(*) as count FROM payments.payment_signals WHERE proof_id = $1`, [proofId]);
    return parseInt(result.rows[0].count, 10);
}
//# sourceMappingURL=payment-signal.repository.js.map