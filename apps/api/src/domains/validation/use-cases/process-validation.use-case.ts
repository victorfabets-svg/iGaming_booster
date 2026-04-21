import { findProofById, findProofByHash } from '../repositories/proof.repository';
import { findValidationByProofId } from '../repositories/proof-validation.repository';
import { updateValidationStatusWithClient } from '../repositories/proof-validation.repository';
import { extractTextFromImage, OcrResult } from '../services/ocr.service';
import { validateWithHeuristics, HeuristicResult } from '../services/heuristic.service';
// EVENT-DRIVEN: fraud and payments are decoupled - no direct imports
// fraud_check_requested → fraud consumer → fraud_scored
// payment_identifier_requested → payments consumer → payment_identifier_extracted
import { logger, alertMonitor } from '../../../../../../shared/observability/logger';
import { recordValidationResult } from '../../../../../../shared/observability/metrics.service';
import { isValidationEnabled } from '../../../../../../shared/config/feature-flags';
import { config } from '../../../../../../shared/config/env';
import { withTransactionalOutbox, insertEventInTransaction, insertAuditInTransaction } from '../../../../../../shared/events/transactional-outbox';

export interface ProcessValidationInput {
  proof_id: string;
}

export type ValidationDecision = 'approved' | 'rejected' | 'manual_review' | 'processing';

export interface ProcessValidationResult {
  validation_id: string;
  proof_id: string;
  decision: ValidationDecision;
  confidence_score: number;
  ocr_result: OcrResult;
  heuristic_result: HeuristicResult;
}

export async function processValidation(input: ProcessValidationInput): Promise<ProcessValidationResult> {
  const { proof_id } = input;

  // Check if validation is enabled
  if (!isValidationEnabled()) {
    logger.warn('validation_disabled', 'validation', 'Validation is currently disabled', undefined, { proof_id });
    throw new Error('Validation is currently disabled');
  }

  // EVENT-DRIVEN FLOW (ENFORCED):
  // proof_submitted → validation emits fraud_check_requested + payment_identifier_requested
  // validation_aggregator → waits for fraud_scored + payment_identifier_extracted
  // → emits proof_validated OR proof_rejected
  // NO CROSS-DOMAIN CALLS - events only
  const approvalThreshold = config.validation.approvalThreshold;
  const manualReviewThreshold = config.validation.manualReviewThreshold;

  console.log(`🔄 Processing validation for proof: ${proof_id} (thresholds: approval=${approvalThreshold}, manualReview=${manualReviewThreshold})`);

  // Load proof from database
  const proof = await findProofById(proof_id);
  if (!proof) {
    throw new Error(`Proof not found: ${proof_id}`);
  }
  console.log(`📄 Loaded proof: file_url = ${proof.file_url}, hash = ${proof.hash}`);

  // Step 0: Check for duplicate hash (duplicates → rejected)
  const duplicateProof = await findProofByHash(proof.hash);
  if (duplicateProof && duplicateProof.id !== proof_id) {
    console.log(`⚠️  Duplicate hash detected: ${proof.hash} (existing proof: ${duplicateProof.id})`);
    
    // Get validation record
    const validation = await findValidationByProofId(proof_id);
    
    // Use transactional outbox - ALL domain writes inside transaction
    await withTransactionalOutbox(async (client) => {
      if (validation) {
        await updateValidationStatusWithClient(client, validation.id, 'rejected', 0.0);
      }
      
      // Insert event in same transaction
      await insertEventInTransaction(
        client,
        'proof_rejected',
        {
          proof_id: proof_id,
          user_id: proof.user_id,
          file_url: proof.file_url,
          submitted_at: proof.submitted_at,
          validation_id: validation?.id,
          reason: 'duplicate_hash',
        },
        'validation'
      );
      
      // Insert audit in same transaction
      if (validation) {
        await insertAuditInTransaction(
          client,
          'proof_rejected',
          'validation',
          validation.id,
          proof.user_id,
          { reason: 'duplicate_hash', proof_id }
        );
      }
    });
    console.log(`📢 Emitted proof_rejected event: duplicate hash (transactional)`);

    return {
      validation_id: validation?.id || '',
      proof_id: proof_id,
      decision: 'rejected',
      confidence_score: 0,
      ocr_result: { amount: 0, date: '', institution: '', identifier: null },
      heuristic_result: { is_valid: false, issues: ['duplicate hash'] },
    };
  }

  alertMonitor.recordApprovalAttempt();
  logger.info('validation_started', 'validation', `Starting validation for proof: ${proof_id}`, proof.user_id, { proof_id });

  try {
    // Step 1: Run OCR (local - validation domain)
    console.log(`🔍 Running OCR...`);
    const ocrResult = extractTextFromImage(proof.file_url);
    console.log(`   Amount: ${ocrResult.amount}, Date: ${ocrResult.date}, Institution: ${ocrResult.institution}`);

    // Step 2: Run heuristic validation (local - validation domain)
    console.log(`⚙️  Running heuristic validation...`);
    const heuristicResult = validateWithHeuristics(ocrResult);
    console.log(`   Valid: ${heuristicResult.is_valid}, Issues: ${heuristicResult.issues.length}`);

    // Step 3: Get validation record
    const validation = await findValidationByProofId(proof_id);
    if (!validation) {
      throw new Error(`Validation not found for proof: ${proof_id}`);
    }

    // Use transactional outbox - emit events to trigger async processing
    await withTransactionalOutbox(async (client) => {
      // Domain write: Update validation status to processing
      await updateValidationStatusWithClient(client, validation.id, 'processing', 0);
      
      // EVENT: Emit fraud_check_requested - triggers fraud consumer
      await insertEventInTransaction(
        client,
        'fraud_check_requested',
        {
          proof_id: proof_id,
          user_id: proof.user_id,
          file_url: proof.file_url,
          submitted_at: proof.submitted_at,
          ocr_result: {
            amount: ocrResult.amount,
            date: ocrResult.date,
            institution: ocrResult.institution,
            identifier: ocrResult.identifier || null,
          },
          heuristic_result: {
            is_valid: heuristicResult.is_valid,
            issues: heuristicResult.issues,
          },
          risk_score_modifier: 0,
          payment_modifier: 0,
        },
        'validation'
      );

      // EVENT: Emit payment_identifier_requested - triggers payments consumer
      await insertEventInTransaction(
        client,
        'payment_identifier_requested',
        {
          proof_id: proof_id,
          user_id: proof.user_id,
          file_url: proof.file_url,
          submitted_at: proof.submitted_at,
          ocr_result: {
            amount: ocrResult.amount,
            date: ocrResult.date,
            institution: ocrResult.institution,
            identifier: ocrResult.identifier || null,
          },
        },
        'validation'
      );

      // Audit: Insert audit log for validation started
      await insertAuditInTransaction(
        client,
        'validation_started',
        'validation',
        validation.id,
        proof.user_id,
        { proof_id, status: 'processing' }
      );
    });

    console.log(`📢 Emitted fraud_check_requested + payment_identifier_requested (async aggregation)`);
    console.log(`⏳ Waiting for validation_aggregator to correlate and emit final decision...`);

    // Return placeholder - actual decision comes from aggregator
    return {
      validation_id: validation.id,
      proof_id: proof_id,
      decision: 'processing',
      confidence_score: 0,
      ocr_result: ocrResult,
      heuristic_result: heuristicResult,
    };
  } catch (error) {
    // FAILSAFE - Any error → emit proof_rejected
    console.error(`❌ Validation error: ${error}`);
    
    // Get validation record
    const validation = await findValidationByProofId(proof_id);
    
    // Use transactional outbox - emit error event
    await withTransactionalOutbox(async (client) => {
      if (validation) {
        await updateValidationStatusWithClient(client, validation.id, 'manual_review');
      }
      
      await insertEventInTransaction(client, 'proof_rejected', {
        proof_id: proof_id,
        user_id: proof.user_id,
        file_url: proof.file_url,
        submitted_at: proof.submitted_at,
        validation_id: validation?.id,
        reason: 'validation_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'validation');

      if (validation) {
        await insertAuditInTransaction(
          client,
          'validation_error',
          'validation',
          validation.id,
          proof.user_id,
          { error: error instanceof Error ? error.message : 'Unknown error', proof_id }
        );
      }
    });
    console.log(`📢 Emitted proof_rejected event: validation error → manual_review (transactional)`);

    return {
      validation_id: validation?.id || '',
      proof_id: proof_id,
      decision: 'manual_review',
      confidence_score: 0,
      ocr_result: { amount: 0, date: '', institution: '', identifier: null },
      heuristic_result: { is_valid: false, issues: ['validation error'] },
    };
  }
}