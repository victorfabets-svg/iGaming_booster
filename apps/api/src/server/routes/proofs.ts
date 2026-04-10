import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../../domains/validation/application/createProofUseCase';

interface ProofMultipart {
  user_id: string;
  file: any; // MultipartFile from @fastify/multipart
}

export async function proofRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ProofMultipart }>(
    '/proofs',
    async (request: FastifyRequest<{ Body: ProofMultipart }>, reply: FastifyReply) => {
      // Extract parts from multipart form
      const userIdPart = await request.file({ partType: 'field' });
      const filePart = await request.file({ partType: 'file' });

      // Validate user_id
      if (!userIdPart || userIdPart.fieldname !== 'user_id') {
        return reply.status(400).send({ error: 'Missing required field: user_id' });
      }
      const user_id = (await userIdPart.value.toString()).trim();
      if (!user_id) {
        return reply.status(400).send({ error: 'user_id cannot be empty' });
      }

      // Validate file
      if (!filePart || filePart.fieldname !== 'file') {
        return reply.status(400).send({ error: 'Missing required file upload' });
      }

      // Read file buffer from stream
      const fileBuffer = await filePart.toBuffer();

      // Validate file buffer
      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({ error: 'Uploaded file is empty' });
      }

      // Extract filename for potential validation
      const filename = filePart.filename;
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