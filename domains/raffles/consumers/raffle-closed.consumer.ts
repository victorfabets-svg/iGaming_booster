import { fetchAndLockEvents, getRetryCount, processWithRetry } from '../../../shared/events/event-consumer.repository';
import { getRaffleById } from '../application/get-active-raffle';
import { db } from '../../../shared/database/connection';
import { executeRaffleDraw } from '../../../apps/api/src/domains/raffles/use-cases/execute-raffle-draw.use-case';

const EVENT_TYPE = 'raffle_closed';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

interface RaffleClosedPayload {
  raffle_id: string;
  seed: string;
  total_tickets: number;
}

export async function startRaffleClosedConsumer(): Promise<void> {
  console.log('🎰 Starting raffle_closed consumer for draw execution...');

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
    console.error('❌ Error polling raffle_closed events:', error);
  }
}

async function processEvent(event: { event_id?: string; id?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RaffleClosedPayload;
  const retryCount = await getRetryCount(eventId);

  console.log(`🎰 Processing raffle_closed event: ${eventId} (retry: ${retryCount})`);
  console.log(`   Raffle: ${payload.raffle_id}, Tickets: ${payload.total_tickets}`);

  const success = await processWithRetry(
    eventId,
    payload,
    async () => {
      await handleRaffleClosed(payload);
    }
  );

  if (success) {
    console.log(`✅ Event ${eventId} processed successfully`);
  } else {
    console.log(`📬 Event ${eventId} sent to DLQ after 3 retries`);
  }
}

/**
 * Handle raffle_closed event - execute draw for the raffle.
 * IDEMPOTENT: Only executes if raffle status is 'closed'.
 */
async function handleRaffleClosed(payload: RaffleClosedPayload): Promise<void> {
  const { raffle_id } = payload;

  // Step 1: Validate raffle exists and is closed (idempotency check)
  const raffle = await getRaffleById(raffle_id);
  
  if (!raffle) {
    console.log(`⚠️  Raffle ${raffle_id} not found, skipping draw`);
    return;
  }

  if (raffle.status !== 'closed') {
    console.log(`⚠️  Raffle ${raffle_id} has status '${raffle.status}', expected 'closed'. Skipping draw.`);
    return;
  }

  // Step 2: Check if draw already executed (query raffle_draws table)
  const drawResult = await db.query<{ winner_user_id: string | null }>(
    `SELECT winner_user_id FROM raffles.raffle_draws WHERE raffle_id = $1`,
    [raffle_id]
  );

  if (drawResult.rows[0]?.winner_user_id) {
    console.log(`⚠️  Raffle ${raffle_id} already has winner, skipping draw`);
    return;
  }

  // Step 3: Execute the draw
  console.log(`🎲 Executing draw for raffle: ${raffle_id}`);
  
  const result = await executeRaffleDraw({ raffle_id });
  
  console.log(`🏆 Draw completed: ${raffle_id}, winner: ${result.winning_ticket_id ?? 'none'}`);
}

if (require.main === module) {
  startRaffleClosedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}