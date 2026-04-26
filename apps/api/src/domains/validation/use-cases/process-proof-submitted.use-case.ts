import { createProofValidationWithClient, findValidationByProofId, updateValidationStatusWithClient, CreateProofValidationInput } from '../repositories/proof-validation.repository';
import { findProofById } from '../repositories/proof.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';
import { getFlag } from '@shared/config/feature-flags';
import { runOcr, OcrInput } from '../services/ocr.service';
import { matchHouseFromOcr } from '../services/payment-identifier-matcher.service';
import * as crypto from 'crypto';

export interface ProofSubmittedEventPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
}

export async function processProofSubmitted(payload: ProofSubmittedEventPayload, client: any): Promise<void> {
  logger.info({
    event: 'proof_submitted_processing',
    context: 'validation',
    data: { proof_id: payload.proof_id }
  });

  // Check if validation already exists (idempotency)
  const existingValidation = await findValidationByProofId(payload.proof_id);
  
  if (existingValidation) {
    logger.info({
      event: 'validation_already_exists',
      context: 'validation',
      data: { proof_id: payload.proof_id }
    });
    return;
  }

  // Create validation input
  const validationInput: CreateProofValidationInput = {
    proof_id: payload.proof_id,
    status: 'processing',
    validation_version: 'v1',
  };

  logger.info({
    event: 'validation_pipeline_start',
    context: 'validation',
    data: { proof_id: payload.proof_id }
  });
  
  try {
    // Domain write: Create validation record
    const validation = await createProofValidationWithClient(client, validationInput);
    logger.info({
      event: 'validation_created',
      context: 'validation',
      data: { validation_id: validation.id, proof_id: payload.proof_id, status: validation.status }
    });

    // T3 OCR: Run OCR on the proof image if T3_OCR_REAL_ENABLED is true
    // This runs in parallel with fraud check for the short-circuit path
    if (getFlag('T3_SHORT_CIRCUIT_ENABLED')) {
      // Calculate file hash from S3 URL
      const fileHash = crypto.createHash('sha256').update(payload.file_url).digest('hex');
      
      const ocrInput: OcrInput = {
        file_url: payload.file_url,
        file_hash: fileHash,
        proof_id: payload.proof_id,
      };
      
      const ocrResult = await runOcr(ocrInput);
      
      // OCR execution is recorded inside the provider (1 row per call)
      
      if (ocrResult.status !== 'success') {
        // OCR unavailable or failed - route to manual_review
        const reason = ocrResult.status === 'unavailable' ? 'ocr_disabled' : 'ocr_failed';
        
        await updateValidationStatusWithClient(client, validation.id, 'manual_review');
        
        await insertEventInTransaction(
          client,
          'proof_validated',
          {
            proof_id: payload.proof_id,
            user_id: payload.user_id,
            file_url: payload.file_url,
            submitted_at: payload.submitted_at,
            validation_id: validation.id,
            status: 'manual_review',
            reason: reason,
            ocr_error: ocrResult.reason || undefined,
          },
          'validation'
        );
        
        await insertAuditInTransaction(
          client,
          'ocr_failed',
          'validation',
          validation.id,
          payload.user_id,
          { reason, ocr_status: ocrResult.status, proof_id: payload.proof_id }
        );
        
        await client.query('COMMIT');
        
        logger.info({
          event: 'ocr_failed_manual_review',
          context: 'validation',
          data: { proof_id: payload.proof_id, status: ocrResult.status, reason: ocrResult.reason }
        });
        
        return;
      }
      
      // OCR succeeded - try to match to a house (need country from proof)
      const proof = await findProofById(payload.proof_id);
      const country = 'US'; // Default, would come from user profile in production
      
      const houseMatch = await matchHouseFromOcr(ocrResult, country);
      
      if (!houseMatch) {
        // No house matched - route to manual_review
        await updateValidationStatusWithClient(client, validation.id, 'manual_review');
        
        await insertEventInTransaction(
          client,
          'proof_validated',
          {
            proof_id: payload.proof_id,
            user_id: payload.user_id,
            file_url: payload.file_url,
            submitted_at: payload.submitted_at,
            validation_id: validation.id,
            status: 'manual_review',
            reason: 'no_house_match',
            ocr_amount: ocrResult.amount,
            ocr_currency: ocrResult.currency,
          },
          'validation'
        );
        
        await insertAuditInTransaction(
          client,
          'no_house_match',
          'validation',
          validation.id,
          payload.user_id,
          { proof_id: payload.proof_id, amount: ocrResult.amount }
        );
        
        await client.query('COMMIT');
        
        logger.info({
          event: 'no_house_match_manual_review',
          context: 'validation',
          data: { proof_id: payload.proof_id, amount: ocrResult.amount }
        });
        
        return;
      }
      
      // House matched - emit payment_identifier_extracted with OCR data
      // The aggregator will combine this with fraud score for final decision
      await insertEventInTransaction(
        client,
        'payment_identifier_extracted',
        {
          proof_id: payload.proof_id,
          user_id: payload.user_id,
          identifiers: [
            {
              type: 'ocr_reference',
              value: ocrResult.payment_identifier || `OCR-${payload.proof_id.slice(0, 8)}`,
              confidence: ocrResult.confidence,
            },
          ],
          validation: {
            valid_count: 1,
            invalid_count: 0,
            has_valid_identifiers: true,
            total_confidence: ocrResult.confidence,
          },
          ocr_data: {
            amount: ocrResult.amount,
            currency: ocrResult.currency,
            house_slug: houseMatch.house_slug,
          },
        },
        'validation'
      );
    }

    // Event: Insert validation_started
    await insertEventInTransaction(
      client,
      'validation_started',
      {
        proof_id: payload.proof_id,
        validation_id: validation.id,
        user_id: payload.user_id,
      },
      'validation'
    );

    // Audit: Insert audit log
    await insertAuditInTransaction(
      client,
      'validation_started',
      'validation',
      validation.id,
      payload.user_id,
      { proof_id: payload.proof_id }
    );

    // EVENT CHAIN: proof_submitted → fraud_check_requested + payment_identifier_requested
    // Sprint 5.2 pipeline contract — both events fan out from validation_started.
    // T3 short-circuit: when flag is ON, aggregator emits payment_identifier_requested
    // conditionally after fraud score arrives. Skip it here to avoid parallel execution.
    await insertEventInTransaction(
      client,
      'fraud_check_requested',
      {
        proof_id: payload.proof_id,
        user_id: payload.user_id,
        validation_id: validation.id,
      },
      'validation'
    );

    if (!getFlag('T3_SHORT_CIRCUIT_ENABLED')) {
      // Legacy parallel path: emit payment request alongside fraud.
      // When T3 is on, the aggregator emits this conditionally after
      // fraud score arrives.
      await insertEventInTransaction(
        client,
        'payment_identifier_requested',
        {
          proof_id: payload.proof_id,
          user_id: payload.user_id,
          validation_id: validation.id,
          file_url: payload.file_url,
        },
        'validation'
      );
    }

    logger.info({
      event: 'validation_pipeline_completed',
      context: 'validation',
      data: { proof_id: payload.proof_id }
    });
  } catch (error) {
    logger.error('validation_error', 'validation', `Failed: ${error}`);
    
    const proof = await findProofById(payload.proof_id);
    const validation = await findValidationByProofId(payload.proof_id);
    
    if (validation) {
      await updateValidationStatusWithClient(client, validation.id, 'manual_review');
    }

    // Spec contract: terminal decisions emit proof_validated with status in payload.
    // Failsafe routes to manual_review so an operator inspects the failure.
    await insertEventInTransaction(
      client,
      'proof_validated',
      {
        proof_id: payload.proof_id,
        user_id: proof?.user_id || payload.user_id,
        file_url: proof?.file_url || '',
        submitted_at: payload.submitted_at,
        validation_id: validation?.id,
        status: 'manual_review',
        reason: 'validation_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'validation'
    );
  
    if (validation) {
      await insertAuditInTransaction(
        client,
        'validation_error',
        'validation',
        validation.id,
        proof?.user_id || payload.user_id,
        { error: error instanceof Error ? error.message : 'Unknown error', proof_id: payload.proof_id }
      );
    }
  }
}
