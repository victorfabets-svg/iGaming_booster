import { fetchAndLockEvents, getRetryCount, processWithRetry } from '../../../shared/events/event-consumer.repository';
import { getActiveRaffle } from '../application/get-active-raffle';
import { db } from '../../../shared/database/connection';
import { randomUUID } from 'crypto';
import { logger } from '../../../shared/observability/logger';

const EVENT_TYPE = 'reward_granted';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

interface RewardGrantedPayload {
  reward_id: string;
  proof_id: string;
  user_id: string;
  reward_type: string;
  value: number;
}

export async function startRewardGrantedConsumer(): Promise<void> {
  logger.info('consumer_started', 'raffles', 'Starting reward_granted consumer for ticket generation');

  await pollEvents();

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
      event: 'events_polled',
      context: 'raffles',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_error', 'raffles', 'Error polling reward_granted events', undefined, {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}

async function processEvent(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RewardGrantedPayload;
  const retryCount = await getRetryCount(eventId);

  logger.info({
    event: 'event_processing',
    context: 'raffles',
    data: { event_id: eventId, user_id: payload.user_id, reward_id: payload.reward_id, retry_count: retryCount }
  });

  const success = await processWithRetry(
    eventId,
    payload,
    async () => {
      await processRewardGranted(eventId, payload);
    }
  );

  if (success) {
    logger.info({
      event: 'event_processed',
      context: 'raffles',
      data: { event_id: eventId, status: 'success' }
    });
  } else {
    logger.warn({
      event: 'event_dlq',
      context: 'raffles',
      data: { event_id: eventId, status: 'sent_to_dlq', retry_count: 3 }
    });
  }
}

const CONSUMER_NAME = 'reward_granted_consumer';

async function processRewardGranted(eventId: string, payload: RewardGrantedPayload): Promise<void> {
  // Single atomic transaction: idempotency + validation + ticket + audit
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Step 0: Idempotency check - INSERT processed_events
    const idempotencyResult = await client.query(
      `INSERT INTO events.processed_events (event_id, consumer_name, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id, consumer_name) DO NOTHING
       RETURNING event_id`,
      [eventId, CONSUMER_NAME]
    );

    // If already processed, log audit in same transaction and return
    if (idempotencyResult.rowCount === 0) {
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'event_duplicate_ignored', 'event', eventId, payload.user_id, JSON.stringify({
          consumer: CONSUMER_NAME,
          reason: 'event_already_processed'
        })]
      );
      await client.query('COMMIT');
      return;
    }

    // Step 1: Validate reward inside transaction (lock + check status)
    const rewardCheck = await client.query<{ id: string; status: string; user_id: string; proof_id: string }>(
      `SELECT id, status, user_id, proof_id FROM rewards.rewards WHERE id = $1 FOR UPDATE`,
      [payload.reward_id]
    );

    if (rewardCheck.rows.length === 0 || rewardCheck.rows[0].status !== 'granted') {
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'invalid_reward_state', 'reward', payload.reward_id, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          reason: rewardCheck.rows.length === 0 ? 'not_found' : 'invalid_status'
        })]
      );
      await client.query('COMMIT');
      return;
    }

    // Validate user ownership - fail-safe: reject mismatched user
    if (rewardCheck.rows[0].user_id !== payload.user_id) {
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'user_mismatch', 'reward', payload.reward_id, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          reward_user_id: rewardCheck.rows[0].user_id,
          payload_user_id: payload.user_id,
          reason: 'user_id_mismatch'
        })]
      );
      await client.query('COMMIT');
      return;
    }

    // Step 2: Validate and lock raffle inside transaction
    const raffle = await getActiveRaffle(new Date());
    if (!raffle) {
      await client.query('COMMIT');
      return;
    }

    const raffleCheck = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM raffles.raffles WHERE id = $1 FOR UPDATE`,
      [raffle.id]
    );

    if (raffleCheck.rows.length === 0 || raffleCheck.rows[0].status !== 'active') {
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'invalid_raffle_state', 'raffle', raffle.id, payload.user_id, JSON.stringify({
          raffle_id: raffle.id,
          reason: raffleCheck.rows.length === 0 ? 'not_found' : 'raffle_not_active'
        })]
      );
      await client.query('COMMIT');
      return;
    }

    // Step 3: Validate proof exists
    const proofCheck = await client.query<{ id: string }>(
      `SELECT id FROM validation.proofs WHERE id = $1`,
      [rewardCheck.rows[0].proof_id]
    );

    if (proofCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'proof_not_found', 'proof', rewardCheck.rows[0].proof_id, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          proof_id: rewardCheck.rows[0].proof_id,
          reason: 'proof_not_found'
        })]
      );
      await client.query('COMMIT');
      return;
    }

    // Step 4: Insert ticket with idempotent conflict handling
    // Use rowCount to determine: created (1) vs duplicate (0)
    const ticketResult = await client.query(
      `INSERT INTO raffles.tickets (user_id, proof_id, reward_id, raffle_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reward_id) DO NOTHING
       RETURNING id`,
      [payload.user_id, payload.proof_id, payload.reward_id, raffle.id]
    );

    // PURE LOGIC: audit is NOT control logic
    if (ticketResult.rowCount === 1 && ticketResult.rows[0]?.id) {
      // Ticket created - audit with ticket id
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'ticket_created', 'ticket', ticketResult.rows[0].id, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          proof_id: payload.proof_id,
          raffle_id: raffle.id
        })]
      );
    } else {
      // Duplicate - audit with null entity_id
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'ticket_duplicate_ignored', 'ticket', null, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          reason: 'idempotency_conflict'
        })]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  startRewardGrantedConsumer().catch((error) => {
    logger.error('fatal_error', 'raffles', 'Fatal error starting consumer', undefined, {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
}