"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProofUseCase = createProofUseCase;
const crypto_1 = require("crypto");
const emitter_1 = require("../../../shared/events/emitter");
const proofRepository_1 = require("../infrastructure/proofRepository");
function generateHash(buffer) {
    return (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
}
function simulateStorage(proofId) {
    return `https://storage.local/proofs/${proofId}`;
}
async function createProofUseCase(input) {
    console.log('[PROOF] Request received for user_id:', input.user_id);
    // Validate buffer is not empty
    if (!input.file_buffer || input.file_buffer.length === 0) {
        throw new Error('Invalid file buffer: empty or missing');
    }
    // Generate hash from file buffer
    const hash = generateHash(input.file_buffer);
    // Generate proof ID for storage URL simulation
    const tempId = `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileUrl = simulateStorage(tempId);
    // Insert proof - DB enforces idempotency via UNIQUE constraint
    const result = await (0, proofRepository_1.createProof)(input, fileUrl, hash);
    console.log('[PROOF] Created proof:', result.proof.id);
    // Only emit event for new proofs (not duplicates)
    if (result.isNew) {
        await (0, emitter_1.emitEvent)({
            event_type: 'proof_submitted',
            producer: 'validation',
            payload: {
                proof_id: result.proof.id,
                user_id: result.proof.user_id,
                hash: result.proof.hash,
            },
        });
        console.log('[PROOF] Event proof_submitted emitted for:', result.proof.id);
    }
    else {
        console.log('[PROOF] Duplicate proof - skipping event emit');
    }
    return { proof_id: result.proof.id, status: 'submitted' };
}
//# sourceMappingURL=createProofUseCase.js.map