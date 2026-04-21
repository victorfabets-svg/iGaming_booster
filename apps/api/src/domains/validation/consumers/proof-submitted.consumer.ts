/**
 * Proof Submitted Consumer
 * Listens for proof_submitted events from validation domain
 * Triggers fraud check and payment identifier extraction
 * 
 * EVENT FLOW:
 * proof_submitted → [this consumer] → emits fraud_check_requested + payment_identifier_requested
 */

import { fetchAndLockEvents, processEventExactlyOnce, Event } from '../../../../../../shared/events/event-consumer.repository';
import { processProofSubmitted, ProofSubmittedEventPayload } from '../use-cases/process-proof-submitted.use-case';
import { logger } from '@shared/observability/logger';

const EVENT_TYPE = 'proof_submitted';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = 'proof_submitted_consumer';

export async function startProofSubmittedConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'validation',
    data: { event_type: EVENT_TYPE, poll_interval_ms: POLL_INTERVAL_MS, batch_size: BATCH_SIZE }
  });

  // Schema now handled by migration (009_hardening_layer.sql)
  // Fail-fast if schema missing - intentional
  logger.info({
    event: 'schema_expected',
    context: 'validation',
    data: { message: 'Event schema expected from migration' }
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
      context: 'validation',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'validation', `Error polling events: ${error}`);
  }
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as ProofSubmittedEventPayload;

  logger.info({
    event: 'event_processing',
    context: 'validation',
    data: { event_id: eventId, proof_id: payload.proof_id }
  });

  const result = await processEventExactlyOnce(eventId, async (client) => {
    await handleEvent(payload, client);
  }, CONSUMER_NAME);

  if (result.skipped) {
    logger.info({ event: 'event_skipped', context: 'validation', data: { event_id: eventId } });
    return;
  }

  logger.info({ event: 'event_processed', context: 'validation', data: { event_id: eventId } });
}

async function handleEvent(payload: ProofSubmittedEventPayload, client: any): Promise<void> {
  await processProofSubmitted(payload, client);
}

// For running as standalone script
if (require.main === module) {
  startProofSubmittedConsumer().catch((error) => {
    logger.error('fatal_error', 'validation', `Fatal error: ${error}`);
    process.exit(1);
  });
}
