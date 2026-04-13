"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProof = createProof;
exports.findByHash = findByHash;
const crypto_1 = require("crypto");
const connection_1 = require("../../../../../../shared/database/connection");
async function createProof(proof, fileUrl, hash) {
    const id = (0, crypto_1.randomUUID)();
    const submitted_at = new Date().toISOString();
    try {
        await connection_1.db.query(`INSERT INTO validation.proofs (id, user_id, file_url, hash, submitted_at)
       VALUES ($1, $2, $3, $4, $5)`, [id, proof.user_id, fileUrl, hash, submitted_at]);
        return {
            proof: {
                id,
                user_id: proof.user_id,
                file_url: fileUrl,
                hash,
                submitted_at,
            },
            isNew: true,
        };
    }
    catch (error) {
        // Handle UNIQUE constraint violation - return existing proof
        if (error.code === '23505' && error.constraint === 'proofs_hash_key') {
            const existing = await findByHash(hash);
            if (existing) {
                console.log('[PROOF] Duplicate detected at DB level, returning existing:', existing.id);
                return { proof: existing, isNew: false };
            }
        }
        throw error;
    }
}
async function findByHash(hash) {
    const result = await connection_1.db.query(`SELECT id, user_id, file_url, hash, submitted_at FROM validation.proofs WHERE hash = $1`, [hash]);
    if (result.rows.length === 0) {
        return null;
    }
    return result.rows[0];
}
//# sourceMappingURL=proofRepository.js.map