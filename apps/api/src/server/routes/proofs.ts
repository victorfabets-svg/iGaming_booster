import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../domains/validation/application/createProofUseCase';
import { authMiddleware } from '../../infrastructure/auth/middleware';

export async function proofRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  fastify.post(
    '/proofs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Zero trust: user_id extracted from token, NOT from body
      const user_id = (request as any).userId;
      
      if (!user_id) {
        return reply.status(401).send({ error: 'Unauthorized: valid token required' });
      }

      // Use parts() iterator to handle multipart form data
      const parts = request.parts();

      let fileBuffer: Buffer | null = null;
      let filename: string | null = null;

      // Async iteration over parts
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          // Read file buffer from stream
          fileBuffer = await part.toBuffer();
          filename = part.filename;
        }
        // NOTE: user_id no longer accepted from body - extracted from token only
      }

      // Validate file
      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({ error: 'Missing required file upload or file is empty' });
      }

      console.log(`[PROOF] Received file: ${filename}, size: ${fileBuffer.length} bytes, user: ${user_id}`);

      const result = await createProofUseCase({
        user_id,
        file_buffer: fileBuffer,
        filename: filename || undefined,
      });

      // Build response with optional signed URL
      const response: any = {
        proof_id: result.proof_id,
        status: result.status,
      };
      
      if (result.file_url) {
        response.file_url = result.file_url;
        response.expires_in = result.expires_in;
      }

      return reply.status(201).send(response);
    }
  );
}