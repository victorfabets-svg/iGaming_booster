/**
 * Payment Identifier Requested Consumer
 * Listens for payment_identifier_requested events from validation domain
 * Extracts payment identifiers and emits payment_identifier_extracted event
 * 
 * EVENT FLOW:
 * validation → emits payment_identifier_requested → [this consumer] → emits payment_identifier_extracted
 */

import { fetchAndLockEvents, getRetryCount, isEventProcessed, markEventAsProcessed, processEventExactlyOnce } from '@shared/events/event-consumer.repository';
import { createPaymentSignalWithClient } from '../repositories/payment-signal.repository';
import { extractIdentifiers } from '../services/identifier.service';
import { validateIdentifier, validateIdentifiers } from '../services/identifier-validation.service';
import { withTransactionalOutbox, insertEventInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';

const EVENT_TYPE = 'payment_identifier_requested';
const EVENT_VERSION = 'v1';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = "payment_identifier_requested_consumer";

interface PaymentIdentifierRequestedPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
  ocr_result?: {
    amount: number;
    date: string;
    institution: string;
  };
}

export async function startPaymentIdentifierRequestedConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'payments',
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
      context: 'payments',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'payments', `Error polling events: ${error}`);
  }
}

async function processEvent(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as PaymentIdentifierRequestedPayload;
  
  const retryCount = await getRetryCount(eventId);
  
  logger.info({
    event: 'event_processing',
    context: 'payments',
    data: { event_id: eventId, proof_id: payload.proof_id, retry_count: retryCount }
  });

  const result = await processEventExactlyOnce(eventId, async () => {
    await handlePaymentIdentifierRequested(payload);
  });

  if (result.skipped) {
    logger.info({ event: 'event_skipped', context: 'payments', data: { event_id: eventId, status: 'already_processed' } });
  } else if (result.success) {
    logger.info({ event: 'event_processed', context: 'payments', data: { event_id: eventId, status: 'success' } });
  } else {
    logger.info({ event: 'event_failed', context: 'payments', data: { event_id: eventId, status: 'failed' } });
  }
}

async function handlePaymentIdentifierRequested(payload: PaymentIdentifierRequestedPayload): Promise<void> {
  const { proof_id, ocr_result } = payload;

  // Extract payment identifiers using payments domain services
  const ocrData = ocr_result || { amount: 0, date: '', institution: '', identifier: null };
  const extractedIdentifiers = extractIdentifiers(ocrData);
  
  // Validate identifiers
  const identifierValidationResult = validateIdentifiers(extractedIdentifiers);
  
  logger.info({
    event: 'identifiers_extracted',
    context: 'payments',
    data: { 
      proof_id, 
      count: extractedIdentifiers.length,
      valid: identifierValidationResult.valid_count,
      invalid: identifierValidationResult.invalid_count
    }
  });

  // Use transactional outbox to persist signals and emit event
  await withTransactionalOutbox(async (client) => {
    // Persist payment signals
    for (const identifier of extractedIdentifiers) {
      const identValidation = validateIdentifier(identifier.type, identifier.value);
      await createPaymentSignalWithClient(client, {
        proof_id,
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

    // Emit payment_identifier_extracted event
    await insertEventInTransaction(
      client,
      'payment_identifier_extracted',
      {
        proof_id,
        user_id: payload.user_id,
        identifiers: extractedIdentifiers.map(i => ({ type: i.type, value: i.value, confidence: i.confidence })),
        validation: identifierValidationResult,
      },
      'payments'
    );
  });

  logger.info({ 
    event: 'payment_identifier_extracted_emitted', 
    context: 'payments', 
    data: { proof_id, count: extractedIdentifiers.length } 
  });
}

// Standalone run
if (require.main === module) {
  startPaymentIdentifierRequestedConsumer().catch((error) => {
    logger.error('fatal_error', 'payments', `Fatal error: ${error}`);
    process.exit(1);
  });
}