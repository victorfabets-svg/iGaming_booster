import { fetchAndLockEvents, getRetryCount, processWithRetry } from '../../../shared/events/event-consumer.repository';
import { getActiveRaffle } from '../application/get-active-raffle';
import { db } from '../../../shared/database/connection';

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
      await processRewardGranted(payload);
    }
  );

  if (success) {
    console.log(`✅ Event ${eventId} processed successfully`);
  } else {
    console.log(`📬 Event ${eventId} sent to DLQ after 3 retries`);
  }
}

async function processRewardGranted(payload: RewardGrantedPayload): Promise<void> {
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

  // Step 4: Idempotent insert - exactly one ticket per reward
  // UNIQUE constraint on reward_id ensures idempotency
  await db.query(
    `INSERT INTO raffles.tickets (user_id, proof_id, reward_id, raffle_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reward_id) DO NOTHING`,
    [payload.user_id, payload.proof_id, payload.reward_id, raffle.id]
  );

  console.log(`🎫 Created eligibility ticket for reward: ${payload.reward_id}`);
}

if (require.main === module) {
  startRewardGrantedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}