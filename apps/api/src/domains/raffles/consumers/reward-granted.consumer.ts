import { fetchAndLockEvents, markEventProcessed, incrementRetryCount, processWithRetry, getRetryCount, Event } from '../../../../../../shared/events/event-consumer.repository';
import { createTicket, CreateTicketInput } from '../../rewards/repositories/ticket.repository';
import { logger } from '../../../../../../shared/observability';

const EVENT_TYPE = 'reward_granted';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startRewardGrantedConsumer(): Promise<void> {
  logger.info('consumer_starting', 'raffles', `Starting reward granted consumer: ${EVENT_TYPE}, poll: ${POLL_INTERVAL_MS}ms, batch: ${BATCH_SIZE}`);

  // Schema now handled by migration (012_raffles_tickets.sql)
  // Fail-fast if schema missing - intentional
  logger.info('schema_expected', 'raffles', 'Ticket schema expected from migration');

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

    logger.info('events_found', 'raffles', `Found ${events.length} events for ${EVENT_TYPE}, batch_size: ${BATCH_SIZE}`);

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

  logger.info('event_processing', 'raffles', `Processing event ${eventId}, reward_id: ${payload.reward_id}, raffle_id: ${payload.raffle_id}, retry: ${retryCount}`, payload.user_id);

  // Use retry logic - increments retry_count on each failure
  // After 3 retries → goes to DLQ
  const success = await processWithRetry(
    eventId,
    payload,
    async () => {
      await createTicketForReward(payload);
    }
  );

  if (success) {
    logger.info('event_processed', 'raffles', `Event processed successfully: ${eventId}, reward_id: ${payload.reward_id}`, payload.user_id);
  } else {
    logger.info('event_dlq', 'raffles', `Event sent to DLQ: ${eventId}, reward_id: ${payload.reward_id}, retry: ${retryCount}`, payload.user_id);
  }
}

async function createTicketForReward(payload: RewardGrantedPayload): Promise<void> {
  // Create ticket - idempotent via ON CONFLICT (reward_id) DO NOTHING
  const ticketInput: CreateTicketInput = {
    user_id: payload.user_id,
    raffle_id: payload.raffle_id,
    reward_id: payload.reward_id,
    proof_id: payload.proof_id,
  };

  const ticket = await createTicket(ticketInput);

  if (ticket) {
    logger.info('ticket_created', 'raffles', `Ticket created for reward ${payload.reward_id}, ticket_id: ${ticket.id}`, payload.user_id);
  } else {
    // Ticket already exists (idempotent - reward_id already has ticket)
    logger.info('ticket_already_exists', 'raffles', `Ticket already exists for reward ${payload.reward_id}`, payload.user_id);
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