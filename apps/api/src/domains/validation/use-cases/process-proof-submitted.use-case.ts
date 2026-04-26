/**
 * Process Proof Submitted Use-Case
 * 
 * Complete rewrite per FIX-9: proper branching for OCR, no manual COMMIT,
 * canonical event chain preserved.
 */

import { createProofValidationWithClient, findValidationByProofId, updateValidationStatusWithClient, CreateProofValidationInput } from '../repositories/proof-validation.repository';
import { findProofById } from '../repositories/proof.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';
import { getFlag } from '@shared/config/feature-flags';
import { runOcr, OcrInput } from '../services/ocr.service';
import { matchHouseFromOcr } from '../services/payment-identifier-matcher.service';

export interface ProofSubmittedEventPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
}

/**
 * Emit terminal manual_review decision with proper event chain.
 * NO client.query(COMMIT) here - caller manages transaction.
 */
async function emitTerminalManualReview(
  client: any,
  validationId: string,
  payload: ProofSubmittedEventPayload,
  reason: string,
  ocrError: string | null,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await updateValidationStatusWithClient(client, validationId, 'manual_review');
  
  await insertEventInTransaction(
    client,
    'proof_validated',
    {
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      file_url: payload.file_url,
      submitted_at: payload.submitted_at,
      validation_id: validationId,
      status: 'manual_review',
      reason,
      ocr_error: ocrError || undefined,
      ...extra,
    },
    'validation'
  );
  
  await insertAuditInTransaction(
    client,
    reason,
    'validation',
    validationId,
    payload.user_id,
    { proof_id: payload.proof_id, ...extra }
  );
  
  logger.info({
    event: 'manual_review_emitted',
    context: 'validation',
    data: { proof_id: payload.proof_id, validation_id: validationId, reason }
  });
}

export async function processProofSubmitted(payload: ProofSubmittedEventPayload, client: any): Promise<void> {
  logger.info({
    event: 'proof_submitted_processing',
    context: 'validation',
    data: { proof_id: payload.proof_id }
  });

  // Idempotency check
  const existingValidation = await findValidationByProofId(payload.proof_id);
  if (existingValidation) {
    logger.info({
      event: 'validation_already_exists',
      context: 'validation',
      data: { proof_id: payload.proof_id }
    });
    return;
  }

  logger.info({
    event: 'validation_pipeline_start',
    context: 'validation',
    data: { proof_id: payload.proof_id }
  });

  try {
    // 1. ALWAYS emit lifecycle events FIRST (before any early return per FIX-9)
    const validation = await createProofValidationWithClient(client, {
      proof_id: payload.proof_id,
      status: 'processing',
      validation_version: 'v1',
    });

    await insertEventInTransaction(client, 'validation_started', {
      proof_id: payload.proof_id,
      validation_id: validation.id,
      user_id: payload.user_id,
    }, 'validation');

    await insertAuditInTransaction(client, 'validation_started', 'validation',
      validation.id, payload.user_id, { proof_id: payload.proof_id });

    await insertEventInTransaction(client, 'fraud_check_requested', {
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      validation_id: validation.id,
    }, 'validation');

    // FIX-4: country from env var, default BR
    const country = process.env.OCR_DEFAULT_COUNTRY || 'BR';

    // 2. Branch by T3_OCR_REAL_ENABLED (FIX-1: correct flag!)
    const ocrEnabled = getFlag('T3_OCR_REAL_ENABLED');

    if (!ocrEnabled) {
      // Legacy path: emit payment_identifier_requested if short-circuit OFF
      if (!getFlag('T3_SHORT_CIRCUIT_ENABLED')) {
        await insertEventInTransaction(client, 'payment_identifier_requested', {
          proof_id: payload.proof_id,
          user_id: payload.user_id,
          validation_id: validation.id,
          file_url: payload.file_url,
        }, 'validation');
      }
      
      logger.info({
        event: 'validation_pipeline_completed',
        context: 'validation',
        data: { proof_id: payload.proof_id, path: 'legacy' }
      });
      return;
    }

    // 3. OCR-driven path (FIX-9)
    const ocrInput: OcrInput = {
      file_url: payload.file_url,
      proof_id: payload.proof_id,
    };

    const ocrResult = await runOcr(ocrInput);

    if (ocrResult.status !== 'success') {
      // OCR unavailable/error/timeout → terminal manual_review
      const reasonMap: Record<string, string> = {
        unavailable: 'ocr_disabled',
        error: 'ocr_failed',
        timeout: 'ocr_timeout',
      };
      const reason = reasonMap[ocrResult.status] || 'ocr_failed';
      
      await emitTerminalManualReview(client, validation.id, payload, reason, ocrResult.reason || null);
      return;
    }

    // FIX-14: Don't manufacture payment_identifier
    if (!ocrResult.payment_identifier) {
      await emitTerminalManualReview(client, validation.id, payload, 'no_payment_identifier', null, {
        ocr_amount: ocrResult.amount,
      });
      return;
    }

    // OCR succeeded - try to match house
    const match = await matchHouseFromOcr(ocrResult, country);

    if (!match) {
      await emitTerminalManualReview(client, validation.id, payload, 'no_house_match', null, {
        ocr_amount: ocrResult.amount,
        ocr_currency: ocrResult.currency,
      });
      return;
    }

    // FIX-2 raw_text already in ocrResult from provider

    // OCR success + house matched + identifier real → emit extracted (FIX-9: replaces requested)
    await insertEventInTransaction(client, 'payment_identifier_extracted', {
      proof_id: payload.proof_id,
      user_id: payload.user_id,
      validation_id: validation.id,
      identifiers: [{
        type: 'ocr_reference',
        value: ocrResult.payment_identifier,
        confidence: ocrResult.confidence,
      }],
      validation: {
        valid_count: 1,
        invalid_count: 0,
        has_valid_identifiers: true,
        total_confidence: ocrResult.confidence,
      },
      ocr_data: {
        amount: ocrResult.amount,
        currency: ocrResult.currency,
        house_slug: match.house_slug,
      },
    }, 'validation');

    logger.info({
      event: 'validation_pipeline_completed',
      context: 'validation',
      data: { proof_id: payload.proof_id, path: 'ocr', house: match.house_slug }
    });
  } catch (error) {
    // Existing error handling - preserve without COMMIT/ROLLBACK per FIX-3
    logger.error('validation_error', 'validation', `Failed: ${error}`);

    const proof = await findProofById(payload.proof_id);
    const validation = await findValidationByProofId(payload.proof_id);

    if (validation) {
      await updateValidationStatusWithClient(client, validation.id, 'manual_review');
    }

    // Spec contract: terminal decisions emit proof_validated with status in payload
    await insertEventInTransaction(client, 'proof_validated', {
      proof_id: payload.proof_id,
      user_id: proof?.user_id || payload.user_id,
      file_url: proof?.file_url || '',
      submitted_at: payload.submitted_at,
      validation_id: validation?.id,
      status: 'manual_review',
      reason: 'validation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'validation');

    if (validation) {
      await insertAuditInTransaction(client, 'validation_error', 'validation',
        validation.id,
        proof?.user_id || payload.user_id,
        { error: error instanceof Error ? error.message : 'Unknown error', proof_id: payload.proof_id }
      );
    }
  }
}
