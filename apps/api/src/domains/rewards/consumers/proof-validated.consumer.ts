import { fetchAndLockEvents, markEventProcessed, incrementRetryCount, processWithRetry, getRetryCount, Event } from '../../../../../../shared/events/event-consumer.repository';
import { processReward } from '../../rewards/use-cases/process-reward.use-case';
import { logger } from '../../../../../../shared/observability/logger';

const EVENT_TYPE = 'proof_validated';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startProofValidatedConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'rewards',
    data: { event_type: EVENT_TYPE, poll_interval_ms: POLL_INTERVAL_MS, batch_size: BATCH_SIZE }
  });

  // Schema now handled by migration (009_hardening_layer.sql)
  // Fail-fast if schema missing - intentional
  logger.info({
    event: 'schema_expected',
    context: 'rewards',
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
    // Use row-level locking - FOR UPDATE SKIP LOCKED
    const allEvents = await fetchAndLockEvents(BATCH_SIZE);
    
    // Filter by event type
    const events = allEvents.filter(e => e.event_type === EVENT_TYPE);

    if (events.length === 0) {
      return;
    }

    logger.info({
      event: 'events_found',
      context: 'rewards',
      data: { event_type: EVENT_TYPE, count: events.length, batch_size: BATCH_SIZE }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error(
      'poll_events_error',
      'rewards',
      `Error polling events: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

interface ProofValidatedPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
  validation_id: string;
  status: string;
  confidence_score: number;
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as ProofValidatedPayload;
  const retryCount = await getRetryCount(eventId);

  logger.info({
    event: 'event_processing',
    context: 'rewards',
    data: { event_id: eventId, event_type: EVENT_TYPE, proof_id: payload.proof_id, status: payload.status, retry_count: retryCount },
    user_id: payload.user_id
  });

  // Use retry logic - increments retry_count on each failure
  // After 3 retries → goes to DLQ
  const success = await processWithRetry(
    eventId,
    payload,
    async () => {
      await processReward(payload);
    }
  );

  if (success) {
    logger.info({
      event: 'event_processed',
      context: 'rewards',
      data: { event_id: eventId, proof_id: payload.proof_id, status: 'success' },
      user_id: payload.user_id
    });
  } else {
    logger.info({
      event: 'event_dlq',
      context: 'rewards',
      data: { event_id: eventId, proof_id: payload.proof_id, status: 'dlq', retry_count: retryCount },
      user_id: payload.user_id
    });
  }
}

// For running as standalone script
if (require.main === module) {
  startProofValidatedConsumer().catch((error) => {
    logger.error(
      'fatal_error',
      'rewards',
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
