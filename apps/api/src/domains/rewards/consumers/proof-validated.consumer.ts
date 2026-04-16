import { fetchAndLockEvents, markEventProcessed, incrementRetryCount, processWithRetry, getRetryCount, Event } from '../../../../../../shared/events/event-consumer.repository';
import { processReward } from '../../rewards/use-cases/process-reward.use-case';
import { logger } from '../../../../../../shared/observability';

const EVENT_TYPE = 'proof_validated';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startProofValidatedConsumer(): Promise<void> {
  logger.info('consumer_starting', 'rewards', `Starting proof validated consumer: ${EVENT_TYPE}, poll: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE}`);

  // Schema now handled by migration (009_hardening_layer.sql)
  // Fail-fast if schema missing - intentional
  logger.info('schema_expected', 'rewards', 'Event schema expected from migration');

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

    logger.info('events_found', 'rewards', `Found ${events.length} events for ${EVENT_TYPE}, batch_size: ${BATCH_SIZE}`);

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

  logger.info('event_processing', 'rewards', `Processing event ${eventId}, proof_id: ${payload.proof_id}, status: ${payload.status}, retry: ${retryCount}`, payload.user_id);

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
    logger.info('event_processed', 'rewards', `Event processed successfully: ${eventId}, proof_id: ${payload.proof_id}`, payload.user_id);
  } else {
    logger.info('event_dlq', 'rewards', `Event sent to DLQ: ${eventId}, proof_id: ${payload.proof_id}, retry: ${retryCount}`, payload.user_id);
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
