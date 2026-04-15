import { fetchAndLockEvents, getRetryCount, processWithRetry } from '../../../shared/events/event-consumer.repository';
import { getActiveRaffle } from '../application/get-active-raffle';
import { db } from '../../../shared/database/connection';
import { randomUUID } from 'crypto';

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
  console.log('🎁 Starting reward_granted consumer for ticket generation...');

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

    console.log(`📬 Found ${events.length} ${EVENT_TYPE} events`);

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    console.error('❌ Error polling reward_granted events:', error);
  }
}

async function processEvent(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RewardGrantedPayload;
  const retryCount = await getRetryCount(eventId);

  console.log(`\n🎁 Processing reward_granted event: ${eventId} (retry: ${retryCount})`);
  console.log(`   User: ${payload.user_id}, Reward: ${payload.reward_id}`);

  const success = await processWithRetry(
    eventId,
    payload,
    async () => {
      await processRewardGranted(eventId, payload);
    }
  );

  if (success) {
    console.log(`✅ Event ${eventId} processed successfully`);
  } else {
    console.log(`📬 Event ${eventId} sent to DLQ after 3 retries`);
  }
}

const CONSUMER_NAME = 'reward_granted_consumer';

async function processRewardGranted(eventId: string, payload: RewardGrantedPayload): Promise<void> {
  // Step 0: Atomic idempotency check + audit in single transaction
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const idempotencyResult = await client.query(
      `INSERT INTO events.processed_events (event_id, consumer_name, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id, consumer_name) DO NOTHING
       RETURNING event_id`,
      [eventId, CONSUMER_NAME]
    );

    // If already processed, log audit in same transaction
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

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Step 1: Validate reward exists and has valid status
  // DB is source of truth - validate status before ticket creation
  const rewardResult = await db.query<{ id: string; user_id: string; proof_id: string; status: string }>(
    `SELECT id, user_id, proof_id, status
     FROM rewards.rewards
     WHERE id = $1`,
    [payload.reward_id]
  );

  if (rewardResult.rows.length === 0) {
    await db.query(
      `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [randomUUID(), 'reward_not_found', 'reward', payload.reward_id, payload.user_id, JSON.stringify({
        reward_id: payload.reward_id,
        reason: 'reward_not_found'
      })]
    );
    return;
  }

  const reward = rewardResult.rows[0];

  // Validate reward status is 'granted' - fail-safe default
  if (reward.status !== 'granted') {
    await db.query(
      `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [randomUUID(), 'invalid_reward_state', 'reward', reward.id, payload.user_id, JSON.stringify({
        reward_id: reward.id,
        expected_status: 'granted',
        actual_status: reward.status,
        reason: 'reward_status_not_granted'
      })]
    );
    return;
  }

  // Validate user_id matches - prevent ticket creation for wrong user
  if (reward.user_id !== payload.user_id) {
    await db.query(
      `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [randomUUID(), 'user_id_mismatch', 'reward', reward.id, payload.user_id, JSON.stringify({
        reward_id: reward.id,
        event_user_id: payload.user_id,
        reward_user_id: reward.user_id,
        reason: 'user_id_mismatch'
      })]
    );
    return;
  }

  // Step 2: Validate proof exists
  const proofResult = await db.query<{ id: string }>(
    `SELECT id FROM validation.proofs WHERE id = $1`,
    [reward.proof_id]
  );

  if (proofResult.rows.length === 0) {
    await db.query(
      `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [randomUUID(), 'proof_not_found', 'proof', reward.proof_id, payload.user_id, JSON.stringify({
        reward_id: payload.reward_id,
        proof_id: reward.proof_id,
        reason: 'proof_not_found'
      })]
    );
    return;
  }

  // Step 3: Get active raffle - FREEZE RULE: do nothing if none exists
  const raffle = await getActiveRaffle(new Date());
  
  if (!raffle) {
    return;
  }

  // Step 4: Full atomic transaction - validation + ticket + audit
  // This guarantees: all succeed or all rollback
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Validate reward inside transaction (lock + check status)
    const rewardCheck = await client.query<{ id: string; status: string; user_id: string }>(
      `SELECT id, status, user_id FROM rewards.rewards WHERE id = $1 FOR UPDATE`,
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

    // Validate and lock raffle inside transaction
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

    // Insert ticket with idempotent conflict handling
    const ticketResult = await client.query(
      `INSERT INTO raffles.tickets (user_id, proof_id, reward_id, raffle_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reward_id) DO NOTHING
       RETURNING id`,
      [payload.user_id, payload.proof_id, payload.reward_id, raffle.id]
    );

    // Audit in same transaction
    if (ticketResult.rowCount === 1) {
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
    console.error('Fatal error:', error);
    process.exit(1);
  });
}