import * as crypto from 'crypto';
import { createProof, findProofByHash, CreateProofInput } from '../repositories/proof.repository';
import { createEvent } from '../../../../../../shared/events/event.repository';
import { rateLimitService } from '../../fraud/services/rate-limit.service';
import { behaviorAnalysisService } from '../../fraud/services/behavior.service';
import { logger, alertMonitor } from '../../../../../../shared/observability/logger';
import { recordProofSubmission } from '../../../../../../shared/observability/metrics.service';

export interface SubmitProofInput {
  user_id: string;
  file_url: string;
}

export interface SubmitProofResult {
  proof_id: string;
}

function generateHash(fileUrl: string): string {
  return crypto.createHash('sha256').update(fileUrl).digest('hex');
}

export async function submitProof(input: SubmitProofInput): Promise<SubmitProofResult> {
  // Validate input
  if (!input.user_id || typeof input.user_id !== 'string') {
    throw new Error('user_id is required');
  }
  if (!input.file_url || typeof input.file_url !== 'string') {
    throw new Error('file_url is required');
  }

  // Check rate limit before submission
  const rateLimitCheck = await rateLimitService.checkProofSubmissionLimit(input.user_id);
  if (!rateLimitCheck.allowed) {
    recordProofSubmission('rate_limited');
    logger.warn('rate_limit_exceeded', 'validation', rateLimitCheck.reason || 'Rate limit exceeded', input.user_id);
    
    // Emit rate_limit_exceeded event
    await createEvent({
      event_type: 'rate_limit_exceeded',
      version: 'v1',
      payload: {
        user_id: input.user_id,
        limit_type: 'proofs_per_hour',
        reason: rateLimitCheck.reason,
      },
      producer: 'validation',
    });
    throw new Error(rateLimitCheck.reason);
  }

  // Generate hash from file_url
  const hash = generateHash(input.file_url);

  // Check if proof already exists (idempotency)
  const existingProof = await findProofByHash(hash);
  if (existingProof) {
    logger.info('proof_duplicate', 'validation', 'Proof already exists, returning existing', input.user_id, { proof_id: existingProof.id });
    return { proof_id: existingProof.id };
  }

  // Perform behavior analysis
  const behaviorCheck = await behaviorAnalysisService.analyzeBehavior(input.user_id);
  if (behaviorCheck.is_suspicious) {
    logger.fraud('fraud_flag_detected', 'Suspicious behavior detected', input.user_id, { signals: behaviorCheck.signals });
    
    // Emit fraud_flag_detected event
    await createEvent({
      event_type: 'fraud_flag_detected',
      version: 'v1',
      payload: {
        user_id: input.user_id,
        file_url: input.file_url,
        signals: behaviorCheck.signals,
        risk_score_modifier: behaviorCheck.risk_score_modifier,
      },
      producer: 'validation',
    });
  }

  // Create proof input
  const proofInput: CreateProofInput = {
    user_id: input.user_id,
    file_url: input.file_url,
    hash: hash,
  };

  // Persist proof first (before emitting event)
  const proof = await createProof(proofInput);
  logger.info('proof_created', 'validation', 'Proof created successfully', input.user_id, { proof_id: proof.id });

  // Record rate limit after successful submission
  await rateLimitService.recordProofSubmission(input.user_id);

  // Emit proof_submitted event
  await createEvent({
    event_type: 'proof_submitted',
    version: 'v1',
    payload: {
      proof_id: proof.id,
      user_id: proof.user_id,
      file_url: proof.file_url,
      submitted_at: proof.submitted_at,
      behavior_signals: behaviorCheck.is_suspicious ? behaviorCheck.signals : null,
    },
    producer: 'validation',
  });

  return { proof_id: proof.id };
}