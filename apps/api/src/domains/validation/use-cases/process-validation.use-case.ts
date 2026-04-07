import { findProofById } from '../../validation/repositories/proof.repository';
import { findValidationByProofId, updateValidationStatus } from '../../validation/repositories/proof-validation.repository';
import { createFraudScore } from '../../fraud/repositories/fraud-score.repository';
import { extractTextFromImage, OcrResult } from '../../validation/services/ocr.service';
import { validateWithHeuristics, HeuristicResult } from '../../validation/services/heuristic.service';
import { calculateFraudScore } from '../../fraud/services/fraud-score.service';
import { createEvent } from '../../../shared/events/event.repository';
import { createPaymentSignal } from '../../payments/repositories/payment-signal.repository';
import { extractIdentifiers } from '../../payments/services/identifier.service';
import { validateIdentifier, validateIdentifiers } from '../../payments/services/identifier-validation.service';
import { logger, alertMonitor } from '../../../shared/observability/logger';
import { recordValidationResult } from '../../../shared/observability/metrics.service';
import { isValidationEnabled, isAutomaticApprovalEnabled } from '../../../shared/config/feature-flags';
import { config } from '../../../shared/config/env';

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

  // Use config for thresholds if automatic approval is enabled
  const useConfigThresholds = isAutomaticApprovalEnabled();
  const approvalThreshold = useConfigThresholds ? config.validation.approvalThreshold : 0.9;
  const manualReviewThreshold = useConfigThresholds ? config.validation.manualReviewThreshold : 0.6;

  console.log(`🔄 Processing validation for proof: ${proof_id}`);

  // Load proof from database
  const proof = await findProofById(proof_id);
  if (!proof) {
    throw new Error(`Proof not found: ${proof_id}`);
  }
  console.log(`📄 Loaded proof: file_url = ${proof.file_url}`);

  alertMonitor.recordApprovalAttempt();
  logger.info('validation_started', 'validation', `Starting validation for proof: ${proof_id}`, proof.user_id, { proof_id, risk_modifier: risk_score_modifier });

  // Step 1: Run OCR (mock)
  console.log(`🔍 Running OCR...`);
  const ocrResult = extractTextFromImage(proof.file_url);
  console.log(`   Amount: ${ocrResult.amount}, Date: ${ocrResult.date}, Institution: ${ocrResult.institution}`);

  // Step 2: Extract payment identifiers
  console.log(`💳 Extracting payment identifiers...`);
  const extractedIdentifiers = extractIdentifiers(ocrResult);
  console.log(`   Found ${extractedIdentifiers.length} identifiers`);

  // Validate identifiers
  const validationResult = validateIdentifiers(extractedIdentifiers);
  console.log(`   Valid: ${validationResult.valid_count}, Invalid: ${validationResult.invalid_count}`);
  console.log(`   Has valid identifiers: ${validationResult.has_valid_identifiers}`);

  // Persist payment signals
  console.log(`💾 Persisting payment signals...`);
  for (const identifier of extractedIdentifiers) {
    const validation = validateIdentifier(identifier.type, identifier.value);
    await createPaymentSignal({
      proof_id: proof_id,
      type: identifier.type,
      value: identifier.value,
      confidence: validation.confidence,
      metadata: {
        source: identifier.source,
        is_valid: validation.is_valid,
        issues: validation.issues,
      },
    });
  }

  // Emit payment_identifier_extracted event
  await createEvent({
    event_type: 'payment_identifier_extracted',
    version: 'v1',
    payload: {
      proof_id: proof_id,
      identifiers: extractedIdentifiers.map(i => ({ type: i.type, value: i.value, confidence: i.confidence })),
      validation: validationResult,
    },
    producer: 'validation',
  });

  // Emit payment_signal_detected if we have valid identifiers
  if (validationResult.has_valid_identifiers) {
    await createEvent({
      event_type: 'payment_signal_detected',
      version: 'v1',
      payload: {
        proof_id: proof_id,
        signal_type: 'valid_payment_identifiers',
        count: validationResult.valid_count,
        confidence: validationResult.total_confidence,
      },
      producer: 'validation',
    });
  }

  // Calculate payment signal confidence modifier
  const paymentModifier = validationResult.has_valid_identifiers 
    ? validationResult.total_confidence * 0.15  // Up to +0.15 for valid identifiers
    : -0.1;  // -0.1 for missing identifiers

  // Step 3: Run heuristic validation
  console.log(`⚙️  Running heuristic validation...`);
  const heuristicResult = validateWithHeuristics(ocrResult);
  console.log(`   Valid: ${heuristicResult.is_valid}, Issues: ${heuristicResult.issues.length}`);

  // Step 4: Generate fraud score (with risk + payment modifiers)
  console.log(`🛡️  Calculating fraud score...`);
  const fraudScoreResult = calculateFraudScore(ocrResult, heuristicResult, risk_score_modifier, paymentModifier);
  console.log(`   Score: ${fraudScoreResult.score} (risk: ${risk_score_modifier}, payment: ${paymentModifier})`);

  // Step 4: Persist fraud score
  console.log(`💾 Persisting fraud score...`);
  await createFraudScore({
    proof_id: proof_id,
    score: fraudScoreResult.score,
    signals: fraudScoreResult.signals,
  });

  // Step 5: Determine decision
  let decision: ValidationDecision;
  if (fraudScoreResult.score >= approvalThreshold) {
    decision = 'approved';
    alertMonitor.recordApproved();
  } else if (fraudScoreResult.score >= manualReviewThreshold) {
    decision = 'manual_review';
  } else {
    decision = 'rejected';
  }
  console.log(`📊 Decision: ${decision} (confidence: ${fraudScoreResult.score}, thresholds: ${approvalThreshold}/${manualReviewThreshold})`);

  // Log validation result
  logger.info('validation_completed', 'validation', `Validation completed: ${decision}`, proof.user_id, { 
    proof_id, 
    decision, 
    confidence: fraudScoreResult.score,
    signals: fraudScoreResult.signals 
  });

  // Record metrics
  recordValidationResult(decision);

  // Step 6: Update validation record
  const validation = await findValidationByProofId(proof_id);
  if (!validation) {
    throw new Error(`Validation not found for proof: ${proof_id}`);
  }

  await updateValidationStatus(validation.id, decision, fraudScoreResult.score);
  console.log(`✅ Validation record updated: status = ${decision}, confidence_score = ${fraudScoreResult.score}`);

  // Emit proof_validated event
  await createEvent({
    event_type: 'proof_validated',
    version: 'v1',
    payload: {
      proof_id: proof_id,
      user_id: proof.user_id,
      file_url: proof.file_url,
      submitted_at: proof.submitted_at,
      validation_id: validation.id,
      status: decision,
      confidence_score: fraudScoreResult.score,
    },
    producer: 'validation',
  });
  console.log(`📢 Emitted proof_validated event`);

  return {
    validation_id: validation.id,
    proof_id: proof_id,
    decision: decision,
    confidence_score: fraudScoreResult.score,
    ocr_result: ocrResult,
    heuristic_result: heuristicResult,
  };
}