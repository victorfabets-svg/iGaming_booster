import { findProofById, findProofByHash } from '../repositories/proof.repository';
import { findValidationByProofId } from '../repositories/proof-validation.repository';
import { updateValidationStatusWithClient } from '../repositories/proof-validation.repository';
import { createFraudScoreWithClient } from '../../fraud/repositories/fraud-score.repository';
import { extractTextFromImage, OcrResult } from '../services/ocr.service';
import { validateWithHeuristics, HeuristicResult } from '../services/heuristic.service';
import { calculateFraudScore } from '../../fraud/services/fraud-score.service';
import { createPaymentSignalWithClient } from '../../payments/repositories/payment-signal.repository';
import { extractIdentifiers } from '../../payments/services/identifier.service';
import { validateIdentifier, validateIdentifiers } from '../../payments/services/identifier-validation.service';
import { logger, alertMonitor } from '../../../../../../shared/observability/logger';
import { recordValidationResult } from '../../../../../../shared/observability/metrics.service';
import { isValidationEnabled, isAutomaticApprovalEnabled } from '../../../../../../shared/config/feature-flags';
import { config } from '../../../../../../shared/config/env';
import { withTransactionalOutbox, insertEventInTransaction, insertAuditInTransaction } from '../../../../../../shared/events/transactional-outbox';

export interface ProcessValidationInput {
  proof_id: string;
  risk_score_modifier?: number;
}

export type ValidationDecision = 'approved' | 'rejected' | 'manual_review';

export interface ProcessValidationResult {
  validation_id: string;
  proof_id: string;
  decision: ValidationDecision;
  confidence_score: number;
  ocr_result: OcrResult;
  heuristic_result: HeuristicResult;
}

export async function processValidation(input: ProcessValidationInput): Promise<ProcessValidationResult> {
  const { proof_id, risk_score_modifier = 0 } = input;

  // Check if validation is enabled
  if (!isValidationEnabled()) {
    logger.warn('validation_disabled', 'validation', 'Validation is currently disabled', undefined, { proof_id });
    throw new Error('Validation is currently disabled');
  }

  // Use config for thresholds only when automatic approval is explicitly enabled
  const automaticApproval = isAutomaticApprovalEnabled();
  const approvalThreshold = automaticApproval ? config.validation.approvalThreshold : 0.9;
  const manualReviewThreshold = automaticApproval ? config.validation.manualReviewThreshold : 0.6;

  console.log(`🔄 Processing validation for proof: ${proof_id} (auto_approval: ${automaticApproval})`);

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
  logger.info('validation_started', 'validation', `Starting validation for proof: ${proof_id}`, proof.user_id, { proof_id, risk_modifier: risk_score_modifier });

  try {
    // Step 1: Run OCR (mock)
    console.log(`🔍 Running OCR...`);
    const ocrResult = extractTextFromImage(proof.file_url);
    console.log(`   Amount: ${ocrResult.amount}, Date: ${ocrResult.date}, Institution: ${ocrResult.institution}`);

    // Step 2: Extract payment identifiers
    console.log(`💳 Extracting payment identifiers...`);
    const extractedIdentifiers = extractIdentifiers(ocrResult);
    console.log(`   Found ${extractedIdentifiers.length} identifiers`);

    // Validate identifiers
    const identifierValidationResult = validateIdentifiers(extractedIdentifiers);
    console.log(`   Valid: ${identifierValidationResult.valid_count}, Invalid: ${identifierValidationResult.invalid_count}`);
    console.log(`   Has valid identifiers: ${identifierValidationResult.has_valid_identifiers}`);

    // Run heuristic validation
    console.log(`⚙️  Running heuristic validation...`);
    const heuristicResult = validateWithHeuristics(ocrResult);
    console.log(`   Valid: ${heuristicResult.is_valid}, Issues: ${heuristicResult.issues.length}`);

    // Calculate fraud score (with risk + payment modifiers)
    console.log(`🛡️  Calculating fraud score...`);
    const paymentModifier = identifierValidationResult.has_valid_identifiers 
      ? identifierValidationResult.total_confidence * 0.15
      : -0.1;
    const fraudScoreResult = calculateFraudScore(ocrResult, heuristicResult, risk_score_modifier, paymentModifier);
    console.log(`   Score: ${fraudScoreResult.score} (risk: ${risk_score_modifier}, payment: ${paymentModifier})`);

    // Determine decision based on score thresholds
    let decision: ValidationDecision;
    
    if (fraudScoreResult.score >= approvalThreshold) {
      decision = 'approved';
      alertMonitor.recordApproved();
    } else if (fraudScoreResult.score >= manualReviewThreshold) {
      decision = 'manual_review';
    } else {
      decision = 'rejected';
    }
    console.log(`📊 Decision: ${decision} (ENABLE_AUTOMATIC_APPROVAL: ${isAutomaticApprovalEnabled()}, confidence: ${fraudScoreResult.score})`);

    logger.info('validation_completed', 'validation', `Validation completed: ${decision}`, proof.user_id, { 
      proof_id, 
      decision, 
      confidence: fraudScoreResult.score,
      signals: fraudScoreResult.signals 
    });

    recordValidationResult(decision);

    // Get validation record
    const validation = await findValidationByProofId(proof_id);
    if (!validation) {
      throw new Error(`Validation not found for proof: ${proof_id}`);
    }

    // Use transactional outbox - ALL domain writes inside single transaction
    await withTransactionalOutbox(async (client) => {
      // Domain write: Persist payment signals
      for (const identifier of extractedIdentifiers) {
        const identValidation = validateIdentifier(identifier.type, identifier.value);
        await createPaymentSignalWithClient(client, {
          proof_id: proof_id,
          type: identifier.type,
          value: identifier.value,
          confidence: identValidation.confidence,
          metadata: {
            source: identifier.source,
            is_valid: identValidation.is_valid,
            issues: identValidation.issues,
          },
        });
      }
      
      // Domain write: Persist fraud score
      await createFraudScoreWithClient(client, {
        proof_id: proof_id,
        score: fraudScoreResult.score,
        signals: fraudScoreResult.signals,
      });

      // Domain write: Update validation status
      await updateValidationStatusWithClient(client, validation.id, decision, fraudScoreResult.score);
      
      // Event: Insert based on decision
      if (decision === 'approved') {
        await insertEventInTransaction(client, 'proof_validated', {
          proof_id: proof_id,
          user_id: proof.user_id,
          file_url: proof.file_url,
          submitted_at: proof.submitted_at,
          validation_id: validation.id,
          status: decision,
          confidence_score: fraudScoreResult.score,
        }, 'validation');
        
        // Emit payment_identifier_extracted domain event for audit
        await insertEventInTransaction(client, 'payment_identifier_extracted', {
          proof_id: proof_id,
          identifiers: extractedIdentifiers.map(i => ({ type: i.type, value: i.value, confidence: i.confidence })),
          validation: identifierValidationResult,
        }, 'validation');

        if (identifierValidationResult.has_valid_identifiers) {
          // Emit payment_signal_detected domain event for observability
          await insertEventInTransaction(client, 'payment_signal_detected', {
            proof_id: proof_id,
            signal_type: 'valid_payment_identifiers',
            count: identifierValidationResult.valid_count,
            confidence: identifierValidationResult.total_confidence,
          }, 'validation');
        }
      } else {
        // Emit proof_rejected domain event for audit
        await insertEventInTransaction(client, 'proof_rejected', {
          proof_id: proof_id,
          user_id: proof.user_id,
          file_url: proof.file_url,
          submitted_at: proof.submitted_at,
          validation_id: validation.id,
          status: decision,
          confidence_score: fraudScoreResult.score,
          reason: decision === 'rejected' ? 'low_confidence' : 'manual_review_required',
        }, 'validation');
      }

      // Audit: Insert audit log
      await insertAuditInTransaction(
        client,
        'validation_completed',
        'validation',
        validation.id,
        proof.user_id,
        { decision, confidence_score: fraudScoreResult.score, proof_id }
      );
    });
    console.log(`📢 Emitted ${decision} event (transactional)`);

    return {
      validation_id: validation.id,
      proof_id: proof_id,
      decision: decision,
      confidence_score: fraudScoreResult.score,
      ocr_result: ocrResult,
      heuristic_result: heuristicResult,
    };
  } catch (error) {
    // FAILSAFE - Any error → manual_review
    console.error(`❌ Validation error: ${error}`);
    
    // Get validation record
    const validation = await findValidationByProofId(proof_id);
    
    // Use transactional outbox - ALL domain writes inside transaction
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