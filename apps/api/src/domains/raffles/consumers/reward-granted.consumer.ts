/**
 * Reward Granted Consumer
 * Listens for reward_granted events from rewards domain
 * Creates raffle tickets for rewarded users
 * 
 * EVENT FLOW:
 * reward_granted → [this consumer] → creates ticket + emits numbers_generated
 */

import { fetchAndLockEvents, processEventExactlyOnce, Event } from '@shared/events/event-consumer.repository';
import { findTicketByRewardId, createTicket, CreateTicketInput } from '../../rewards/repositories/ticket.repository';
import { insertEventInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';
import { db } from '@shared/database/connection';

const EVENT_TYPE = 'reward_granted';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = 'reward_granted_consumer';

interface RewardGrantedPayload {
  user_id: string;
  reward_id: string;
  raffle_id: string;
  proof_id: string;
}

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
    const allEvents = await fetchAndLockEvents(BATCH_SIZE);
    const events = allEvents.filter(e => e.event_type === EVENT_TYPE);

    if (events.length === 0) {
      return;
    }

    logger.info({
      event: 'events_found',
      context: 'raffles',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'raffles', `Error polling events: ${error}`);
  }
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RewardGrantedPayload;

  logger.info({
    event: 'event_processing',
    context: 'raffles',
    data: { event_id: eventId, reward_id: payload.reward_id, raffle_id: payload.raffle_id }
  });

  const result = await processEventExactlyOnce(eventId, async (client) => {
    await handleEvent(payload, client);
  }, CONSUMER_NAME);

  if (result.skipped) {
    logger.info({
      event: 'event_skipped',
      context: 'raffles',
      data: { event_id: eventId, reward_id: payload.reward_id }
    });
    return;
  }

  logger.info({
    event: 'event_processed',
    context: 'raffles',
    data: { event_id: eventId, reward_id: payload.reward_id }
  });
}

async function handleEvent(payload: RewardGrantedPayload, client: any): Promise<void> {
  const { user_id, reward_id, raffle_id, proof_id } = payload;

  // Get reward with proof_id - required for ticket creation
  const rewardResult = await client.query<{ id: string; status: string; user_id: string; proof_id: string }>(
    `SELECT id, status, user_id, proof_id
     FROM rewards.rewards
     WHERE id = $1`,
    [reward_id]
  );

  const reward = rewardResult.rows[0];
  if (!reward) {
    throw new Error(`Reward not found: ${reward_id}`);
  }

  // Check if ticket already exists for this reward (idempotency)
  const existingTicket = await findTicketByRewardId(reward_id);
  if (existingTicket) {
    logger.info({
      event: 'ticket_already_exists',
      context: 'raffles',
      data: { reward_id, ticket_id: existingTicket.id }
    });
    return;
  }

  // Create ticket - createTicket handles deterministic number internally
  // Uses SELECT FOR UPDATE to ensure unique sequential numbers
  const ticketInput: CreateTicketInput = {
    user_id,
    raffle_id,
    reward_id,
    proof_id: reward.proof_id,
  };

  const ticket = await createTicket(ticketInput);

  if (ticket) {
    // Emit numbers_generated event via transactional outbox (same transaction)
    await insertEventInTransaction(
      client,
      'numbers_generated',
      {
        ticket_id: ticket.id,
        number: ticket.number,
        reward_id,
        raffle_id,
        proof_id: reward.proof_id,
        user_id,
      },
      'raffles'
    );

    logger.info({
      event: 'numbers_generated',
      context: 'raffles',
      data: { ticket_id: ticket.id, number: ticket.number, reward_id }
    });
  } else {
    logger.warn({
      event: 'ticket_creation_failed',
      context: 'raffles',
      data: { reward_id, reason: 'insert_conflict' }
    });
  }
}

// For running as standalone script
if (require.main === module) {
  startRewardGrantedConsumer().catch((error) => {
    logger.error('fatal_error', 'raffles', `Fatal error: ${error}`);
    process.exit(1);
  });
}