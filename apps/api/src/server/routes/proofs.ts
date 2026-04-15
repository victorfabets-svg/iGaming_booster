import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../../domains/validation/application/createProofUseCase';
import { findProofById, findAllProofs } from '../../../domains/validation/repositories/proof.repository';
import { findValidationByProofId } from '../../../domains/validation/repositories/proof-validation.repository';

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

  // Get proof by ID with validation status
  fastify.get(
    '/proofs/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      
      const proof = await findProofById(id);
      if (!proof) {
        return reply.status(404).send({ error: 'Proof not found' });
      }

      const validation = await findValidationByProofId(id);
      
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
    }
  );

  // Get all proofs with optional limit
  fastify.get(
    '/proofs',
    async (request: FastifyRequest) => {
      const limit = parseInt((request.query as Record<string, string>).limit || '50', 10);
      const proofs = await findAllProofs(limit);
      
      // Get validation for each proof
      const proofsWithValidation = await Promise.all(
        proofs.map(async (proof) => {
          const validation = await findValidationByProofId(proof.id);
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
        })
      );
      
      return proofsWithValidation;
    }
  );
}