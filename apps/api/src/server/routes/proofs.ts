import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../domains/validation/application/createProofUseCase';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { ok, fail } from '../utils/response';
import { rateLimitDb } from '../utils/rate-limit-db';
import { checkIdempotency, saveIdempotency, getIdempotencyKey, reserveIdempotency, getIdempotency, completeIdempotency, releaseStaleIdempotency, isIdempotencyStale } from '../utils/idempotency';
import { auditLog } from '@shared/events/audit-log';
import { findProofById } from '../../domains/validation/repositories/proof.repository';
import { findValidationByProofId } from '../../domains/validation/repositories/proof-validation.repository';
import { getStorageService } from '../../infrastructure/storage';

export async function proofRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  fastify.post(
    '/proofs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Idempotency - reserve key atomically to prevent race conditions
      const idemKey = getIdempotencyKey(request.headers as Record<string, unknown>);
      if (idemKey) {
        const reserve = await reserveIdempotency(idemKey);
        
        if (!reserve.acquired) {
          // Another request got the key - check its status
          const existing = await getIdempotency(idemKey);
          
          if (existing?.status === 'done') {
            // Completed - return cached response (flat shape, no wrapper)
            return reply.send(existing.response);
          }

          // Check if pending is stale (crashed request)
          if (isIdempotencyStale(existing)) {
            // Release stale key and try to re-acquire
            await releaseStaleIdempotency(idemKey);
            const retryReserve = await reserveIdempotency(idemKey);
            if (!retryReserve.acquired) {
              // Another request got it - check again
              const retryExisting = await getIdempotency(idemKey);
              if (retryExisting?.status === 'done') {
                return reply.send(retryExisting.response);
              }
              return fail(reply, 'Request in progress, please retry', 'IDEMPOTENCY_IN_PROGRESS');
            }
          } else {
            // Still in progress - tell client to retry
            return fail(reply, 'Request in progress, please retry', 'IDEMPOTENCY_IN_PROGRESS');
          }
        }
      }

      // Rate limiting - 10 requests per minute per IP (stored in DB for persistence)
      const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
      const allowed = await rateLimitDb(clientIp, 10, 60000);

      if (!allowed) {
        return fail(reply, 'Too many requests', 'RATE_LIMIT');
      }

      // Zero trust: user_id extracted from token, NOT from body
      const user_id = (request as any).userId;
      
      if (!user_id) {
        return fail(reply, 'Unauthorized: valid token required', 'UNAUTHORIZED');
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

      // Validate file: File must be present and non-empty (multipart form data)
      if (!fileBuffer || fileBuffer.length === 0) {
        return fail(reply, 'Missing required file upload or file is empty', 'VALIDATION_ERROR');
      }

      // Use context-aware logger (automatically includes request_id)
      request.log.info({
        event: 'proof_received',
        filename,
        size: fileBuffer.length,
        user_id
      });

      // Get request ID for tracing
      const requestId = (request as any).requestId;

      try {
        const result = await createProofUseCase({
          user_id,
          file_buffer: fileBuffer,
          filename: filename || undefined,
        });

        // Build response — include is_new + submitted_at so the frontend
        // can distinguish a fresh submission from a deduped one.
        const response: any = {
          proof_id: result.proof_id,
          status: result.status,
          is_new: result.is_new,
          submitted_at: result.submitted_at,
        };

        if (result.file_url) {
          response.file_url = result.file_url;
          response.expires_in = result.expires_in;
        }

        // Audit log for successful proof submission
        await auditLog(user_id, 'proof_submitted', { 
          proof_id: result.proof_id,
          filename,
          size: fileBuffer.length 
        }, requestId);

        // Save idempotency key with response (only on success)
        if (idemKey) {
          await completeIdempotency(idemKey, response);
        }

        // Flat shape — no { data } wrapper.
        return reply.send(response);
      } catch (err: any) {
        console.error(err);
        return fail(reply, err.message);
      }
    }
  );

  // GET /proofs/:id — read final validation status.
  // Source of truth: validation.proof_validations.status.
  // Fallback: if proof exists but no validation row yet, status = 'pending'.
  // Response shape is intentionally flat ({ proof_id, status }) — no { data } wrapper.
  fastify.get(
    '/proofs/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const proof = await findProofById(id);
      if (!proof) {
        return reply.status(404).send({ proof_id: id, status: 'not_found' });
      }

      const validation = await findValidationByProofId(id);
      const status = validation?.status ?? 'pending';

      const payload: Record<string, unknown> = {
        proof_id: id,
        status,
      };
      if (validation?.confidence_score != null) {
        payload.confidence_score = validation.confidence_score;
      }

      return reply.send(payload);
    }
  );

  // GET /proofs — list the authenticated user's recent proofs with status.
  // LEFT JOIN proof_validations so rows without a validation yet get status='pending'.
  // Flat array response, newest first, capped at 50.
  fastify.get(
    '/proofs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user_id = (request as any).userId;
      if (!user_id) {
        return fail(reply, 'Unauthorized: valid token required', 'UNAUTHORIZED');
      }

      const { db } = await import('@shared/database/connection');
      const result = await db.query<{
        proof_id: string;
        submitted_at: Date;
        status: string | null;
        confidence_score: number | null;
      }>(
        `SELECT p.id AS proof_id,
                p.submitted_at,
                COALESCE(v.status, 'pending') AS status,
                v.confidence_score
           FROM validation.proofs p
           LEFT JOIN validation.proof_validations v ON v.proof_id = p.id
          WHERE p.user_id = $1
          ORDER BY p.submitted_at DESC
          LIMIT 50`,
        [user_id]
      );

      return reply.send(
        result.rows.map(row => ({
          proof_id: row.proof_id,
          submitted_at: row.submitted_at instanceof Date
            ? row.submitted_at.toISOString()
            : row.submitted_at,
          status: row.status,
          confidence_score: row.confidence_score,
        }))
      );
    }
  );

  // GET /proofs/:id/file — stream the uploaded file back.
  // Auth + ownership gated: only the user who submitted the proof can read it.
  fastify.get(
    '/proofs/:id/file',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user_id = (request as any).userId;
      if (!user_id) {
        return fail(reply, 'Unauthorized: valid token required', 'UNAUTHORIZED');
      }

      const proof = await findProofById(request.params.id);
      if (!proof || proof.user_id !== user_id) {
        // Don't leak existence to non-owners — always 404.
        return reply.status(404).send({ error: 'Not found' });
      }

      const storage = getStorageService();
      const file = await storage.download(proof.file_url);
      if (!file) {
        return reply.status(404).send({ error: 'File missing in storage' });
      }

      return reply
        .header('Content-Type', file.contentType)
        .header('Cache-Control', 'private, max-age=60')
        .send(file.buffer);
    }
  );
}