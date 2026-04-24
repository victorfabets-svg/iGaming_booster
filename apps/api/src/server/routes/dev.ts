/**
 * Dev-only routes for QA testing and local development.
 * ALL routes in this file are guarded by NODE_ENV === 'development'.
 * Returns 404 in any other environment.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { findProofById } from '../../domains/validation/repositories/proof.repository';
import { findValidationByProofId, updateValidationStatus } from '../../domains/validation/repositories/proof-validation.repository';

interface ForceStatusBody {
  proof_id: string;
  status: 'approved' | 'rejected' | 'manual_review';
  confidence_score?: number;
}

interface TokenBody {
  email?: string;
  user_id?: string;
}

function devGuard(reply: FastifyReply): boolean {
  if (process.env.NODE_ENV !== 'development') {
    reply.status(404).send({ error: 'Not found' });
    return false;
  }
  return true;
}

export async function devRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /dev/proofs/force-status
  // Bypasses the async pipeline and writes status directly to validation.proof_validations.
  // QA flow: submit proof → call force-status → poll GET /proofs/:id → frontend shows correct screen.
  fastify.post<{ Body: ForceStatusBody }>(
    '/dev/proofs/force-status',
    async (request: FastifyRequest<{ Body: ForceStatusBody }>, reply: FastifyReply) => {
      if (!devGuard(reply)) return;

      const { proof_id, status, confidence_score } = request.body || {};

      if (!proof_id || !status) {
        return reply.status(400).send({ error: 'proof_id and status are required' });
      }

      if (!['approved', 'rejected', 'manual_review'].includes(status)) {
        return reply.status(400).send({
          error: 'status must be one of: approved, rejected, manual_review'
        });
      }

      // Verify proof exists
      const proof = await findProofById(proof_id);
      if (!proof) {
        return reply.status(404).send({ proof_id, status: 'not_found' });
      }

      // Get or create validation record
      let validation = await findValidationByProofId(proof_id);
      if (!validation) {
        // Create one if it doesn't exist yet (race with worker)
        const { createProofValidation } = await import('../../domains/validation/repositories/proof-validation.repository');
        validation = await createProofValidation({
          proof_id,
          status,
          validation_version: 'dev-fixture',
        });
      } else {
        // Update existing validation
        await updateValidationStatus(validation.id, status, confidence_score);
        // Re-fetch to get updated state
        validation = await findValidationByProofId(proof_id);
      }

      return reply.send({
        proof_id,
        status,
        confidence_score: validation?.confidence_score ?? confidence_score ?? null,
        updated_at: validation?.validated_at?.toISOString() ?? new Date().toISOString(),
      });
    }
  );

  // POST /dev/token
  // Generates a JWT for testing without going through /register + manual signing.
  // Uses the same JWT_SECRET as the API server.
  fastify.post<{ Body: TokenBody }>(
    '/dev/token',
    async (request: FastifyRequest<{ Body: TokenBody }>, reply: FastifyReply) => {
      if (!devGuard(reply)) return;

      const { email, user_id } = request.body || {};
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production-32chars';

      if (!email && !user_id) {
        return reply.status(400).send({ error: 'email or user_id is required' });
      }

      const { createProofValidation } = await import('../../domains/validation/repositories/proof-validation.repository');

      // If email provided, try to look up user in DB
      let resolvedUserId = user_id;
      let resolvedEmail = email;

      if (email && !user_id) {
        const { db } = await import('@shared/database/connection');
        const result = await db.query<{ id: string; email: string }>(
          `SELECT id, email FROM identity.users WHERE email = $1`,
          [email]
        );
        if (result.rows.length > 0) {
          resolvedUserId = result.rows[0].id;
          resolvedEmail = result.rows[0].email;
        } else {
          // Auto-create user
          const crypto = await import('crypto');
          resolvedUserId = crypto.randomUUID();
          await db.query(
            `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW())`,
            [resolvedUserId, email]
          );
          resolvedEmail = email;
        }
      }

      if (!resolvedUserId) {
        return reply.status(400).send({ error: 'Could not resolve user_id' });
      }

      // Import jsonwebtoken
      const jwt = await import('jsonwebtoken');
      const token = jwt.sign(
        { user_id: resolvedUserId, email: resolvedEmail },
        jwtSecret,
        { expiresIn: '30d' }
      );

      return reply.send({ token, user_id: resolvedUserId, email: resolvedEmail });
    }
  );
}