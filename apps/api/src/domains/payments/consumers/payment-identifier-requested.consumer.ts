/**
 * Payment Identifier Requested Consumer
 * Listens for payment_identifier_requested events from validation domain
 * Extracts payment identifiers and emits payment_identifier_extracted event
 * 
 * EVENT FLOW:
 * validation → emits payment_identifier_requested → [this consumer] → emits payment_identifier_extracted
 */

import { fetchAndLockEvents, processEventExactlyOnce, Event } from '@shared/events/event-consumer.repository';
import { createPaymentSignalWithClient } from '../repositories/payment-signal.repository';
import { extractIdentifiers } from '../services/identifier.service';
import { validateIdentifier, validateIdentifiers } from '../services/identifier-validation.service';
import { insertEventInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';
import { normalizeIdentifier } from '../services/identifier-normalizer.service';
import { insertPaymentIdentifierWithClient, countOtherProofsByNormalizedValue } from '../repositories/payment-identifier.repository';

const EVENT_TYPE = 'payment_identifier_requested';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = 'payment_identifier_requested_consumer';

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
    const events = await fetchAndLockEvents(BATCH_SIZE, [EVENT_TYPE]);

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

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as PaymentIdentifierRequestedPayload;

  logger.info({
    event: 'event_processing',
    context: 'payments',
    data: { event_id: eventId, proof_id: payload.proof_id }
  });

  const result = await processEventExactlyOnce(eventId, async (client) => {
    await handlePaymentIdentifierRequested(payload, client);
  }, CONSUMER_NAME);

  if (result.skipped) {
    logger.info({ event: 'event_skipped', context: 'payments', data: { event_id: eventId } });
  } else {
    logger.info({ event: 'event_processed', context: 'payments', data: { event_id: eventId } });
  }
}

async function handlePaymentIdentifierRequested(payload: PaymentIdentifierRequestedPayload, client: any): Promise<void> {
  const { proof_id } = payload;

  const ocrData = payload.ocr_result || { amount: 0, date: '', institution: '', identifier: null };
  const extractedIdentifiers = extractIdentifiers(ocrData);
  
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

  // Persist each identifier to payment_identifiers table with normalized_value and dup_count
  // Count OTHER proofs BEFORE insert so this row doesn't count itself
  const enrichedIdentifiers = await Promise.all(
    extractedIdentifiers.map(async (identifier) => {
      const normalizedValue = normalizeIdentifier(identifier.value);
      const dupCountOtherProofs = await countOtherProofsByNormalizedValue(client, proof_id, normalizedValue);

      await insertPaymentIdentifierWithClient(client, {
        proof_id,
        type: identifier.type,
        raw_value: identifier.value,
        normalized_value: normalizedValue,
        confidence: identifier.confidence,
      });

      return {
        type: identifier.type,
        value: identifier.value,
        confidence: identifier.confidence,
        normalized_value: normalizedValue,
        dup_count_other_proofs: dupCountOtherProofs,
      };
    })
  );

  // Emit payment_identifier_extracted event with enriched payload
  await insertEventInTransaction(
    client,
    'payment_identifier_extracted',
    {
      proof_id,
      user_id: payload.user_id,
      identifiers: enrichedIdentifiers,
      validation: identifierValidationResult,
    },
    'payments'
  );

  logger.info({ 
    event: 'payment_identifier_extracted_emitted', 
    context: 'payments', 
    data: { proof_id, count: enrichedIdentifiers.length } 
  });
}

// Standalone run
if (require.main === module) {
  startPaymentIdentifierRequestedConsumer().catch((error) => {
    logger.error('fatal_error', 'payments', `Fatal error: ${error}`);
    process.exit(1);
  });
}