import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../../domains/validation/application/createProofUseCase';

export async function proofRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/proofs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Use parts() iterator to handle multipart form data
      const parts = request.parts();

      let user_id: string | null = null;
      let fileBuffer: Buffer | null = null;
      let filename: string | null = null;

      // Async iteration over parts
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          // Read file buffer from stream
          fileBuffer = await part.toBuffer();
          filename = part.filename;
        }

        if (part.type === 'field' && part.fieldname === 'user_id') {
          user_id = part.value as string;
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

      const result = await createProofUseCase({
        user_id,
        file_buffer: fileBuffer,
      });

      return reply.status(201).send({
        proof_id: result.proof_id,
        status: result.status,
      });
    }
  );
}