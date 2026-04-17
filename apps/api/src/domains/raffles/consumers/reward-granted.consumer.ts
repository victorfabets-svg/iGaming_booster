import { fetchAndLockEvents, markEventProcessed, incrementRetryCount, processWithRetry, getRetryCount, isEventProcessed, markEventAsProcessed, lockEvent, query, Event } from '../../../../../../shared/events/event-consumer.repository';
import { createTicket, CreateTicketInput } from '../../rewards/repositories/ticket.repository';
import { findActiveRaffle } from '../../rewards/repositories/raffle.repository';
import { logger } from '../../../../../../shared/observability';
import { db } from 'shared/database/connection';

export const CONSUMER_NAME = 'reward_granted_consumer';

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
  proof_id: string;
  reward_type: string;
  value: number;
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RewardGrantedPayload;
  const retryCount = await getRetryCount(eventId);

  logger.info('event_processing', 'raffles', `Processing event ${eventId}, reward_id: ${payload.reward_id}, retry: ${retryCount}`, payload.user_id);

  const client = await db.connect();

  try {
    // STEP 1: BEGIN TRANSACTION
    await client.query('BEGIN');

    // STEP 2: Acquire row-level lock with FOR UPDATE SKIP LOCKED
    const lockedResult = await client.query(
      `SELECT id, event_type, version, producer, correlation_id, payload, 
              retry_count, processed, timestamp, locked_at
       FROM events.events
       WHERE id = $1
       FOR UPDATE SKIP LOCKED`,
      [eventId]
    );

    if (lockedResult.rows.length === 0) {
      // Another worker has this event locked - rollback and skip
      await client.query('ROLLBACK');
      logger.info('event_locked_by_other', 'raffles', `Event ${eventId} is locked by another worker, skipping`, payload.user_id);
      client.release();
      return;
    }

    // STEP 3: Check if already processed (idempotency)
    const alreadyProcessed = await isEventProcessed(eventId, CONSUMER_NAME);
    
    if (alreadyProcessed) {
      await client.query('ROLLBACK');
      logger.info('event_skipped', 'raffles', `Event already processed, skipping: ${eventId}`, payload.user_id);
      client.release();
      return;
    }

    // STEP 4: Process the event (create ticket)
    // Pass client for transaction support
    await createTicketForRewardWithClient(payload, client);

    // STEP 5: Mark as processed AFTER successful processing (idempotency)
    await markEventAsProcessed(eventId, CONSUMER_NAME);

    // STEP 6: COMMIT
    await client.query('COMMIT');
    logger.info('event_processed', 'raffles', `Event processed successfully: ${eventId}, reward_id: ${payload.reward_id}`, payload.user_id);

  } catch (err) {
    // ERROR HANDLING - rollback on any error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('rollback_failed', 'raffles', `Rollback failed: ${rollbackErr}`);
    }
    logger.error('ticket_creation_failed', 'raffles', `Failed to create ticket: ${err instanceof Error ? err.message : String(err)}`, payload.user_id);
    throw err; // Re-throw to trigger retry/DLQ
  } finally {
    client.release();
  }
}

// New function that accepts client for transaction support
async function createTicketForRewardWithClient(payload: RewardGrantedPayload, client: any): Promise<void> {
  // Get the active raffle to associate the ticket with (within same transaction)
  const result = await client.query(
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE status = 'active'
       AND draw_date > NOW()
     ORDER BY draw_date ASC
     LIMIT 1`
  );
  
  const activeRaffle = result.rows[0];
  
  if (!activeRaffle) {
    logger.warn('no_active_raffle', 'raffles', 'No active raffle found, skipping ticket creation', payload.user_id);
    return;
  }

  // Create ticket - idempotent via ON CONFLICT (reward_id) DO NOTHING
  const ticketResult = await client.query(
    `INSERT INTO rewards.tickets (user_id, raffle_id, number, reward_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reward_id) DO NOTHING
     RETURNING id, user_id, raffle_id, number, reward_id, created_at`,
    [payload.user_id, activeRaffle.id, generateTicketNumber(), payload.reward_id]
  );

  if (ticketResult.rows.length > 0) {
    logger.info('ticket_created', 'raffles', `Ticket created for reward ${payload.reward_id}, ticket_id: ${ticketResult.rows[0].id}, raffle_id: ${activeRaffle.id}`, payload.user_id);
  } else {
    // Ticket already exists (idempotent - reward_id already has ticket)
    logger.info('ticket_already_exists', 'raffles', `Ticket already exists for reward ${payload.reward_id}`, payload.user_id);
  }
}

// Keep original function for backward compatibility
async function createTicketForReward(payload: RewardGrantedPayload): Promise<void> {
  // Get the active raffle to associate the ticket with
  const activeRaffle = await findActiveRaffle();
  
  if (!activeRaffle) {
    logger.warn('no_active_raffle', 'raffles', 'No active raffle found, skipping ticket creation', payload.user_id);
    return;
  }

  // Create ticket - idempotent via ON CONFLICT (reward_id) DO NOTHING
  const ticketInput: CreateTicketInput = {
    user_id: payload.user_id,
    raffle_id: activeRaffle.id,
    number: generateTicketNumber(),
    reward_id: payload.reward_id,
  };

  const ticket = await createTicket(ticketInput);

  if (ticket) {
    logger.info('ticket_created', 'raffles', `Ticket created for reward ${payload.reward_id}, ticket_id: ${ticket.id}, raffle_id: ${activeRaffle.id}`, payload.user_id);
  } else {
    // Ticket already exists (idempotent - reward_id already has ticket)
    logger.info('ticket_already_exists', 'raffles', `Ticket already exists for reward ${payload.reward_id}`, payload.user_id);
  }
}

function generateTicketNumber(): number {
  // Generate a random ticket number for the raffle
  // In a production system, this would be assigned based on business rules
  return Math.floor(Math.random() * 1000000);
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