/**
 * Fraud Check Requested Consumer
 * Listens for fraud_check_requested events from validation domain
 * Calculates fraud score and emits fraud_scored event
 * 
 * EVENT FLOW:
 * validation → emits fraud_check_requested → [this consumer] → emits fraud_scored
 */

import { fetchAndLockEvents, getRetryCount, isEventProcessed, markEventAsProcessed, processEventExactlyOnce } from '@shared/events/event-consumer.repository';
import { createFraudScoreWithClient } from '../repositories/fraud-score.repository';
import { calculateFraudScore } from '../services/fraud-score.service';
import { withTransactionalOutbox, insertEventInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';

const EVENT_TYPE = 'fraud_check_requested';
const EVENT_VERSION = 'v1';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = "fraud_check_requested_consumer";

interface FraudCheckRequestedPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
  ocr_result?: {
    amount: number;
    date: string;
    institution: string;
  };
  heuristic_result?: {
    is_valid: boolean;
    issues: string[];
  };
  risk_score_modifier?: number;
  payment_modifier?: number;
}

export async function startFraudCheckRequestedConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'fraud',
    data: { event_type: EVENT_TYPE, poll_interval_ms: POLL_INTERVAL_MS, batch_size: BATCH_SIZE }
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
    const events = allEvents.filter(e => e.event_type === EVENT_TYPE);

    if (events.length === 0) {
      return;
    }

    logger.info({
      event: 'events_found',
      context: 'fraud',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'fraud', `Error polling events: ${error}`);
  }
}

async function processEvent(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as FraudCheckRequestedPayload;
  
  const retryCount = await getRetryCount(eventId);
  
  logger.info({
    event: 'event_processing',
    context: 'fraud',
    data: { event_id: eventId, proof_id: payload.proof_id, retry_count: retryCount }
  });

  const result = await processEventExactlyOnce(eventId, async () => {
    await handleFraudCheckRequested(payload);
  });

  if (result.skipped) {
    logger.info({ event: 'event_skipped', context: 'fraud', data: { event_id: eventId, status: 'already_processed' } });
  } else if (result.success) {
    logger.info({ event: 'event_processed', context: 'fraud', data: { event_id: eventId, status: 'success' } });
  } else {
    logger.info({ event: 'event_failed', context: 'fraud', data: { event_id: eventId, status: 'failed' } });
  }
}

async function handleFraudCheckRequested(payload: FraudCheckRequestedPayload): Promise<void> {
  const { proof_id, ocr_result, heuristic_result, risk_score_modifier = 0, payment_modifier = 0 } = payload;

  // Calculate fraud score using fraud domain services
  const ocrData = ocr_result || { amount: 0, date: '', institution: '' };
  const heuristicData = heuristic_result || { is_valid: true, issues: [] };
  
  const fraudScoreResult = calculateFraudScore(ocrData, heuristicData, risk_score_modifier, payment_modifier);
  
  logger.info({
    event: 'fraud_score_calculated',
    context: 'fraud',
    data: { proof_id, score: fraudScoreResult.score, signals: fraudScoreResult.signals }
  });

  // Use transactional outbox to persist score and emit event
  await withTransactionalOutbox(async (client) => {
    // Persist fraud score
    await createFraudScoreWithClient(client, {
      proof_id,
      score: fraudScoreResult.score,
      signals: fraudScoreResult.signals,
    });

    // Emit fraud_scored event
    await insertEventInTransaction(
      client,
      'fraud_scored',
      {
        proof_id,
        user_id: payload.user_id,
        score: fraudScoreResult.score,
        signals: fraudScoreResult.signals,
        risk_modifier: risk_score_modifier,
        payment_modifier,
      },
      'fraud'
    );
  });

  logger.info({ event: 'fraud_scored_emitted', context: 'fraud', data: { proof_id, score: fraudScoreResult.score } });
}

// Standalone run
if (require.main === module) {
  startFraudCheckRequestedConsumer().catch((error) => {
    logger.error('fatal_error', 'fraud', `Fatal error: ${error}`);
    process.exit(1);
  });
}