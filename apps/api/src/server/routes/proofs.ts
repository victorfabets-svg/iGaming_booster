import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createProofUseCase } from '../../domains/validation/application/createProofUseCase';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { ok, fail } from '../utils/response';
import { rateLimitDb } from '../utils/rate-limit-db';
import { checkIdempotency, saveIdempotency, getIdempotencyKey, reserveIdempotency, getIdempotency, completeIdempotency, releaseStaleIdempotency, isIdempotencyStale } from '../utils/idempotency';
import { auditLog } from '../../../shared/events/audit-log';

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
            // Completed - return cached response
            return ok(reply, existing.response);
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
                return ok(reply, retryExisting.response);
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
      request.logger.info({
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

        // Build response with optional signed URL
        const response: any = {
          proof_id: result.proof_id,
          status: result.status,
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

        return ok(reply, response);
      } catch (err: any) {
        console.error(err);
        return fail(reply, err.message);
      }
    }
  );
}