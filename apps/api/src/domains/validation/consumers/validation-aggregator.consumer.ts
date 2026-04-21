/**
 * Validation Aggregator Consumer
 * Listens for fraud_scored + payment_identifier_extracted events
 * Correlates by proof_id
 * Makes validation decision and emits proof_validated or proof_rejected
 * 
 * EVENT FLOW:
 * proof_submitted → validation starts
 *   → fraud_check_requested → fraud_scored
 *   → payment_identifier_requested → payment_identifier_extracted
 * [this consumer] → correlation + decision → proof_validated / proof_rejected
 */

import { fetchAndLockEvents, getRetryCount, processEventExactlyOnce } from '@shared/events/event-consumer.repository';
import { findValidationByProofId, updateValidationStatusWithClient } from '../repositories/proof-validation.repository';
import { findProofById } from '../repositories/proof.repository';
import { withTransactionalOutbox, insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { logger, alertMonitor } from '@shared/observability/logger';
import { recordValidationResult } from '@shared/observability/metrics.service';
import { config } from '@shared/config/env';

const FRAUD_SCORED_EVENT = 'fraud_scored';
const PAYMENT_EXTRACTED_EVENT = 'payment_identifier_extracted';
const POLL_INTERVAL_MS = 2000; // Faster polling for aggregation
const BATCH_SIZE = 20;

interface FraudScoredPayload {
  proof_id: string;
  user_id: string;
  score: number;
  signals: Record<string, unknown>[];
  risk_modifier?: number;
  payment_modifier?: number;
}

interface PaymentExtractedPayload {
  proof_id: string;
  user_id: string;
  identifiers: Array<{ type: string; value: string; confidence: number }>;
  validation: {
    valid_count: number;
    invalid_count: number;
    has_valid_identifiers: boolean;
    total_confidence: number;
  };
}

// In-memory correlation store (in production, use Redis or DB)
const pendingCorrelations = new Map<string, { fraud?: FraudScoredPayload; payment?: PaymentExtractedPayload }>();

export const CONSUMER_NAME = "validation_aggregator_consumer";

export async function startValidationAggregatorConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'validation',
    data: { 
      listens_for: [FRAUD_SCORED_EVENT, PAYMENT_EXTRACTED_EVENT], 
      poll_interval_ms: POLL_INTERVAL_MS 
    }
  });

  // Initial poll
  await pollEvents();

  // Set up interval for continuous polling
  setInterval(async () => {
    await pollEvents();
  }, POLL_INTERVAL_MS);
}

async function pollEvents(): Promise<void> {
  try {
    const allEvents = await fetchAndLockEvents(BATCH_SIZE);
    
    // Process fraud_scored events
    const fraudEvents = allEvents.filter(e => e.event_type === FRAUD_SCORED_EVENT);
    for (const event of fraudEvents) {
      await processFraudScored(event);
    }

    // Process payment_identifier_extracted events
    const paymentEvents = allEvents.filter(e => e.event_type === PAYMENT_EXTRACTED_EVENT);
    for (const event of paymentEvents) {
      await processPaymentExtracted(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'validation', `Error polling events: ${error}`);
  }
}

async function processFraudScored(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as FraudScoredPayload;
  const proofId = payload.proof_id;

  logger.info({
    event: 'fraud_scored_received',
    context: 'validation',
    data: { event_id: eventId, proof_id: proofId, score: payload.score }
  });

  // Get or create correlation entry
  let correlation = pendingCorrelations.get(proofId) || { fraud: undefined, payment: undefined };
  correlation.fraud = payload;
  pendingCorrelations.set(proofId, correlation);

  // Try to make decision if both events received
  await tryMakeDecision(proofId, eventId);
}

async function processPaymentExtracted(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as PaymentExtractedPayload;
  const proofId = payload.proof_id;

  logger.info({
    event: 'payment_extracted_received',
    context: 'validation',
    data: { event_id: eventId, proof_id: proofId, identifiers: payload.identifiers.length }
  });

  // Get or create correlation entry
  let correlation = pendingCorrelations.get(proofId) || { fraud: undefined, payment: undefined };
  correlation.payment = payload;
  pendingCorrelations.set(proofId, correlation);

  // Try to make decision if both events received
  await tryMakeDecision(proofId, eventId);
}

async function tryMakeDecision(proofId: string, triggeringEventId: string): Promise<void> {
  const correlation = pendingCorrelations.get(proofId);
  
  // Need both events to make decision
  if (!correlation?.fraud || !correlation?.payment) {
    logger.info({
      event: 'waiting_for_correlation',
      context: 'validation',
      data: { 
        proof_id: proofId, 
        has_fraud: !!correlation?.fraud, 
        has_payment: !!correlation?.payment 
      }
    });
    return;
  }

  const fraudPayload = correlation.fraud;
  const paymentPayload = correlation.payment;

  logger.info({
    event: 'both_events_received',
    context: 'validation',
    data: { proof_id: proofId, fraud_score: fraudPayload.score }
  });

  // Make validation decision
  const approvalThreshold = config.validation.approvalThreshold;
  const manualReviewThreshold = config.validation.manualReviewThreshold;

  // Calculate score with payment modifier
  const paymentModifier = paymentPayload.validation.has_valid_identifiers
    ? paymentPayload.validation.total_confidence * 0.15
    : -0.1;
  
  const finalScore = fraudPayload.score + paymentModifier;

  let decision: 'approved' | 'rejected' | 'manual_review';
  
  if (finalScore >= approvalThreshold) {
    decision = 'approved';
    alertMonitor.recordApproved();
  } else if (finalScore >= manualReviewThreshold) {
    decision = 'manual_review';
  } else {
    decision = 'rejected';
  }

  logger.info({
    event: 'validation_decision_made',
    context: 'validation',
    data: { proof_id: proofId, decision, final_score: finalScore, payment_modifier: paymentModifier }
  });

  recordValidationResult(decision);

  // Get validation record
  const validation = await findValidationByProofId(proofId);
  if (!validation) {
    logger.error('validation_not_found', 'validation', `Validation not found for proof: ${proofId}`);
    return;
  }

  const proof = await findProofById(proofId);
  
  // Use transactional outbox - update validation + emit final event
  await withTransactionalOutbox(async (client) => {
    // Domain write: Update validation status
    await updateValidationStatusWithClient(client, validation.id, decision, finalScore);

    // Event: Emit final decision
    if (decision === 'approved') {
      await insertEventInTransaction(
        client,
        'proof_validated',
        {
          proof_id: proofId,
          user_id: proof?.user_id || fraudPayload.user_id,
          file_url: proof?.file_url || '',
          submitted_at: proof?.submitted_at || '',
          validation_id: validation.id,
          status: decision,
          confidence_score: finalScore,
          fraud_score: fraudPayload.score,
          payment_modifier,
        },
        'validation'
      );
    } else {
      await insertEventInTransaction(
        client,
        'proof_rejected',
        {
          proof_id: proofId,
          user_id: proof?.user_id || fraudPayload.user_id,
          file_url: proof?.file_url || '',
          submitted_at: proof?.submitted_at || '',
          validation_id: validation.id,
          status: decision,
          confidence_score: finalScore,
          reason: decision === 'rejected' ? 'low_confidence' : 'manual_review_required',
        },
        'validation'
      );
    }

    // Audit: Insert audit log
    await insertAuditInTransaction(
      client,
      'validation_completed',
      'validation',
      validation.id,
      proof?.user_id || fraudPayload.user_id,
      { decision, confidence_score: finalScore, proof_id: proofId }
    );
  });

  logger.info({
    event: 'final_decision_emitted',
    context: 'validation',
    data: { proof_id: proofId, decision }
  });

  // Clean up correlation
  pendingCorrelations.delete(proofId);
}

// Standalone run
if (require.main === module) {
  startValidationAggregatorConsumer().catch((error) => {
    logger.error('fatal_error', 'validation', `Fatal error: ${error}`);
    process.exit(1);
  });
}