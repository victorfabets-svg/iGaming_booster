/**
 * Proof Validated Consumer
 * Listens for proof_validated events from validation domain
 * Triggers reward granting
 * 
 * EVENT FLOW:
 * proof_validated → [this consumer] → emits reward_granted
 */

import { fetchAndLockEvents, processEventExactlyOnce, Event } from '@shared/events/event-consumer.repository';
import { processReward, ProofValidatedPayload } from '../../rewards/use-cases/process-reward.use-case';
import { logger } from '@shared/observability/logger';

const EVENT_TYPE = 'proof_validated';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = 'proof_validated_consumer';

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
    const events = await fetchAndLockEvents(BATCH_SIZE, [EVENT_TYPE]);

    if (events.length === 0) {
      return;
    }

    logger.info({
      event: 'events_found',
      context: 'rewards',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'rewards', `Error polling events: ${error}`);
  }
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as ProofValidatedPayload;

  logger.info({
    event: 'event_processing',
    context: 'rewards',
    data: { event_id: eventId, proof_id: payload.proof_id, status: payload.status },
    user_id: payload.user_id
  });

  const result = await processEventExactlyOnce(eventId, async (client) => {
    await handleEvent(payload, client);
  }, CONSUMER_NAME);

  if (result.skipped) {
    logger.info({
      event: 'event_skipped',
      context: 'rewards',
      data: { event_id: eventId, proof_id: payload.proof_id }
    });
    return;
  }

  logger.info({
    event: 'event_processed',
    context: 'rewards',
    data: { event_id: eventId, proof_id: payload.proof_id, status: 'success' }
  });
}

async function handleEvent(payload: ProofValidatedPayload, client: any): Promise<void> {
  await processReward(payload, client);
}

// For running as standalone script
if (require.main === module) {
  startProofValidatedConsumer().catch((error) => {
    logger.error('fatal_error', 'rewards', `Fatal error: ${error}`);
    process.exit(1);
  });
}
