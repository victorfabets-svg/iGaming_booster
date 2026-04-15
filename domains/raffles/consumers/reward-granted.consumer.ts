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
  // Step 0: Event-level idempotency check with correct event_id + consumer_name
  // Use INSERT ON CONFLICT to guarantee exactly-once processing
  const idempotencyResult = await db.query(
    `INSERT INTO events.processed_events (event_id, consumer_name, processed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, CONSUMER_NAME]
  );

  // If event already processed, log audit and skip
  if (idempotencyResult.rowCount === 0) {
    await db.query(
      `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [randomUUID(), 'event_duplicate_ignored', 'event', eventId, payload.user_id, JSON.stringify({
        consumer: CONSUMER_NAME,
        reason: 'event_already_processed'
      })]
    );
    return;
  }

  // Step 1: Validate reward exists
  const rewardResult = await db.query<{ id: string; user_id: string; proof_id: string }>(
    `SELECT id, user_id, proof_id
     FROM rewards.rewards
     WHERE id = $1`,
    [payload.reward_id]
  );

  if (rewardResult.rows.length === 0) {
    console.log(`⚠️  Reward ${payload.reward_id} not found, cannot create ticket`);
    return;
  }

  const reward = rewardResult.rows[0];

  // Backend decides everything - no guard checks needed
  // If reward exists, we proceed to create ticket

  if (reward.user_id !== payload.user_id) {
    console.log(`⚠️  Reward user_id mismatch: event=${payload.user_id}, reward=${reward.user_id}, cannot create ticket`);
    return;
  }

  // Step 2: Validate proof exists
  const proofResult = await db.query<{ id: string }>(
    `SELECT id FROM validation.proofs WHERE id = $1`,
    [reward.proof_id]
  );

  if (proofResult.rows.length === 0) {
    console.log(`⚠️  Proof ${reward.proof_id} not found, cannot create ticket`);
    return;
  }

  // Step 3: Get active raffle - FREEZE RULE: do nothing if none exists
  const raffle = await getActiveRaffle(new Date());
  
  if (!raffle) {
    console.log(`⚠️  No active raffle found, skipping ticket creation`);
    return;
  }

  console.log(`🎰 Using raffle: ${raffle.id}`);

  // Step 4: Atomic ticket creation + audit in single transaction
  // This guarantees: ticket + audit succeed together or rollback together
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert ticket with idempotent conflict handling
    const ticketResult = await client.query(
      `INSERT INTO raffles.tickets (user_id, proof_id, reward_id, raffle_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reward_id) DO NOTHING
       RETURNING id`,
      [payload.user_id, payload.proof_id, payload.reward_id, raffle.id]
    );

    // Explicit idempotency check - insert audit in same transaction
    if (ticketResult.rowCount === 1) {
      // Ticket created - insert success audit
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'ticket_created', 'ticket', ticketResult.rows[0].id, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          proof_id: payload.proof_id,
          raffle_id: raffle.id
        })]
      );
      console.log(`🎫 Created new eligibility ticket for reward: ${payload.reward_id}`);
    } else if (ticketResult.rowCount === 0) {
      // Duplicate - insert idempotency audit in same transaction
      await client.query(
        `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), 'ticket_duplicate_ignored', 'ticket', null, payload.user_id, JSON.stringify({
          reward_id: payload.reward_id,
          reason: 'idempotency_conflict'
        })]
      );
      console.log(`⚠️  Duplicate ticket ignored for reward: ${payload.reward_id} (already exists)`);
      console.log(`   📋 idempotency_check: { reward_id: "${payload.reward_id}", status: "duplicate_ignored" }`);
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