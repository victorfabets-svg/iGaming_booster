"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proofRoutes = proofRoutes;
const createProofUseCase_1 = require("../../domains/validation/application/createProofUseCase");
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
            filename: filename || undefined,
        });
        // Build response with optional signed URL
        const response = {
            proof_id: result.proof_id,
            status: result.status,
        };
        if (result.file_url) {
            response.file_url = result.file_url;
            response.expires_in = result.expires_in;
        }
        return reply.status(201).send(response);
    });
}
//# sourceMappingURL=proofs.js.map