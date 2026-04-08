import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../../domains/validation/application/createProofUseCase';

interface ProofBody {
  user_id: string;
  file: string; // base64 encoded for simplicity
}

export async function proofRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ProofBody }>(
    '/proofs',
    async (request: FastifyRequest<{ Body: ProofBody }>, reply: FastifyReply) => {
      const { user_id, file } = request.body;

      if (!user_id || !file) {
        return reply.status(400).send({ error: 'Missing required fields: user_id and file' });
      }

      // Convert base64 to buffer
      const fileBuffer = Buffer.from(file, 'base64');

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