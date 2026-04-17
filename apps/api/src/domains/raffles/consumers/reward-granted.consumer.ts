export const CONSUMER_NAME = "reward_granted_consumer";

import { fetchAndLockEvents, processWithRetry, getRetryCount, markEventAsProcessed, Event } from '../../../../../../shared/events/event-consumer.repository';
import { createTicket, CreateTicketInput } from '../../repositories/ticket.repository';
import { logger } from '../../../../../../shared/observability/logger';
import { db } from '../../../../shared/database/connection';

const EVENT_TYPE = 'reward_granted';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startRewardGrantedConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'raffles',
    data: { event_type: EVENT_TYPE, poll_interval_ms: POLL_INTERVAL_MS, batch_size: BATCH_SIZE }
  });

  // Schema now handled by migration (012_raffles_tickets.sql)
  // Fail-fast if schema missing - intentional
  logger.info({
    event: 'schema_expected',
    context: 'raffles',
    data: { message: 'Ticket schema expected from migration' }
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
      context: 'raffles',
      data: { event_type: EVENT_TYPE, count: events.length, batch_size: BATCH_SIZE }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error(
      'poll_events_error',
      'raffles',
      `Error polling events: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

interface RewardGrantedPayload {
  user_id: string;
  reward_id: string;
  raffle_id: string;
  proof_id: string;
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RewardGrantedPayload;
  const retryCount = await getRetryCount(eventId);

  logger.info({
    event: 'event_processing',
    context: 'raffles',
    data: { event_id: eventId, event_type: EVENT_TYPE, reward_id: payload.reward_id, raffle_id: payload.raffle_id, retry_count: retryCount },
    user_id: payload.user_id
  });

  // Use exactly-once processing for idempotency
  // This ensures the ticket is created exactly once even on retries
  const { success, skipped } = await processEventExactlyOnce(
    eventId,
    async () => {
      // Get reward with proof_id - required for ticket creation
      const rewardResult = await db.query<{ id: string; status: string; user_id: string; proof_id: string }>(
        `SELECT id, status, user_id, proof_id
         FROM rewards.rewards
         WHERE id = $1`,
        [payload.reward_id]
      );
      
      const reward = rewardResult.rows[0];
      if (!reward) {
        throw new Error(`Reward not found: ${payload.reward_id}`);
      }
      
      // Create ticket - idempotent via ON CONFLICT (reward_id) DO NOTHING
      const ticketInput: CreateTicketInput = {
        user_id: payload.user_id,
        raffle_id: payload.raffle_id,
        reward_id: payload.reward_id,
        proof_id: reward.proof_id,
      };

      const ticket = await createTicket(ticketInput);

      if (ticket) {
        logger.info({
          event: 'ticket_created',
          context: 'raffles',
          data: { event_id: eventId, ticket_id: ticket.id, reward_id: payload.reward_id },
          user_id: payload.user_id
        });
      } else {
        // Ticket already exists (idempotent - reward_id already has ticket)
        logger.info({
          event: 'ticket_already_exists',
          context: 'raffles',
          data: { event_id: eventId, reward_id: payload.reward_id },
          user_id: payload.user_id
        });
      }
    }
  );

  if (success && !skipped) {
    logger.info({
      event: 'event_processed',
      context: 'raffles',
      data: { event_id: eventId, reward_id: payload.reward_id, status: 'success' },
      user_id: payload.user_id
    });
  } else if (skipped) {
    logger.info({
      event: 'event_skipped',
      context: 'raffles',
      data: { event_id: eventId, reward_id: payload.reward_id, status: 'already_processed' },
      user_id: payload.user_id
    });
  } else {
    logger.info({
      event: 'event_failed',
      context: 'raffles',
      data: { event_id: eventId, reward_id: payload.reward_id, status: 'failed' },
      user_id: payload.user_id
    });
  }
}

async function processEventExactlyOnce(
  eventId: string,
  processFn: () => Promise<void>
): Promise<{ success: boolean; skipped: boolean }> {
  // Use the shared event consumer repository's exactly-once function
  const { isEventProcessed, markEventAsProcessed, getClient } = await import('../../../../../../shared/events/event-consumer.repository');
  
  // Check if already processed (idempotency) - use consumer-specific key
  const alreadyProcessed = await isEventProcessed(eventId, CONSUMER_NAME);
  if (alreadyProcessed) {
    return { success: true, skipped: true };
  }

  // Process and record in transaction
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Execute the business logic
    await processFn();
    
    // Record successful processing (idempotency key) - use consumer-specific key
    await markEventAsProcessed(eventId, CONSUMER_NAME);
    
    await client.query('COMMIT');
    return { success: true, skipped: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// For running as standalone script
if (require.main === module) {
  startRewardGrantedConsumer().catch((error) => {
    logger.error(
      'fatal_error',
      'raffles',
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}