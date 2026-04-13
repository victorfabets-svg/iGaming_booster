"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProofUseCase = createProofUseCase;
const emitter_1 = require("../../../../../../shared/events/emitter");
const proofRepository_1 = require("../infrastructure/proofRepository");
const hash_1 = require("../../../../../../shared/utils/hash");
const storage_1 = require("../../../infrastructure/storage");
/**
 * Determine content type from file extension
 */
function getContentType(ext) {
    const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'webp': 'image/webp',
    };
    return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
}
async function createProofUseCase(input) {
    console.log('[PROOF] Request received for user_id:', input.user_id);
    // Validate buffer is not empty
    if (!input.file_buffer || input.file_buffer.length === 0) {
        throw new Error('Invalid file buffer: empty or missing');
    }
    // Generate hash first (before any operations that might fail)
    const hash = (0, hash_1.generateSHA256)(input.file_buffer);
    // Get storage service
    const storageService = (0, storage_1.getStorageService)();
    // Generate path and content type in domain layer (not in adapter)
    const filename = input.filename || 'proof.pdf';
    const fileExt = filename.split('.').pop() || 'pdf';
    const path = `proofs/${input.user_id}/${hash.substring(0, 8)}.${fileExt}`;
    const contentType = getContentType(fileExt);
    // Upload file to storage and get storage key
    const { key } = await storageService.upload(input.file_buffer, path, contentType);
    console.log('[PROOF] Storage key:', key);
    // Insert proof - DB enforces idempotency via UNIQUE constraint
    const result = await (0, proofRepository_1.createProof)(input, key, hash);
    console.log('[PROOF] Created proof:', result.proof.id);
    // Generate signed URL for R2 (best effort - failures should not crash the response)
    let signedUrl;
    let expiresIn;
    try {
        // Check if R2 is configured (preferred)
        if (process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
            // getStorageService returns R2StorageAdapter which has getSignedUrl
            signedUrl = await storageService.getSignedUrl(path, 300); // 5 minutes
            expiresIn = 300;
            console.log('[PROOF] Generated signed URL, expires in:', expiresIn, 'seconds');
        }
    }
    catch (error) {
        // Signed URL is optional - log but don't fail
        console.error('[PROOF] Signed URL generation failed:', error.message);
    }
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
    return {
        proof_id: result.proof.id,
        status: 'submitted',
        file_url: signedUrl,
        expires_in: expiresIn
    };
}
//# sourceMappingURL=createProofUseCase.js.map