"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proofRoutes = proofRoutes;
const createProofUseCase_1 = require("../../domains/validation/application/createProofUseCase");
const proof_repository_1 = require("../../domains/validation/repositories/proof.repository");
const proof_validation_repository_1 = require("../../domains/validation/repositories/proof-validation.repository");
async function proofRoutes(fastify) {
    fastify.post('/proofs', async (request, reply) => {
        // Use parts() iterator to handle multipart form data
        const parts = request.parts();
        let user_id = null;
        let fileBuffer = null;
        let filename = null;
        // Async iteration over parts
        for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'file') {
                // Read file buffer from stream
                fileBuffer = await part.toBuffer();
                filename = part.filename;
            }
            if (part.type === 'field' && part.fieldname === 'user_id') {
                user_id = part.value;
            }
        }
        // Validate user_id
        if (!user_id) {
            return reply.status(400).send({ error: 'Missing required field: user_id' });
        }
        // Validate file
        if (!fileBuffer || fileBuffer.length === 0) {
            return reply.status(400).send({ error: 'Missing required file upload or file is empty' });
        }
        console.log(`[PROOF] Received file: ${filename}, size: ${fileBuffer.length} bytes`);
        const result = await (0, createProofUseCase_1.createProofUseCase)({
            user_id,
            file_buffer: fileBuffer,
        });
        return reply.status(201).send({
            proof_id: result.proof_id,
            status: result.status,
        });
    });
    // Get proof by ID with validation status
    fastify.get('/proofs/:id', async (request, reply) => {
        const { id } = request.params;
        const proof = await (0, proof_repository_1.findProofById)(id);
        if (!proof) {
            return reply.status(404).send({ error: 'Proof not found' });
        }
        const validation = await (0, proof_validation_repository_1.findValidationByProofId)(id);
        return {
            id: proof.id,
            user_id: proof.user_id,
            file_url: proof.file_url,
            hash: proof.hash,
            submitted_at: proof.submitted_at,
            status: validation?.status || null,
            confidence_score: validation?.confidence_score || null,
            validated_at: validation?.validated_at || null,
        };
    });
    // Get all proofs with optional limit
    fastify.get('/proofs', async (request) => {
        const limit = parseInt(request.query.limit || '50', 10);
        const proofs = await (0, proof_repository_1.findAllProofs)(limit);
        // Get validation for each proof
        const proofsWithValidation = await Promise.all(proofs.map(async (proof) => {
            const validation = await (0, proof_validation_repository_1.findValidationByProofId)(proof.id);
            return {
                id: proof.id,
                user_id: proof.user_id,
                file_url: proof.file_url,
                hash: proof.hash,
                submitted_at: proof.submitted_at,
                status: validation?.status || null,
                confidence_score: validation?.confidence_score || null,
                validated_at: validation?.validated_at || null,
            };
        }));
        return proofsWithValidation;
    });
}
//# sourceMappingURL=proofs.js.map