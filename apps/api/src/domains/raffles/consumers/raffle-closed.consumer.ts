import { fetchAndLockEvents, getRetryCount, processWithRetry } from '../../../../../shared/events/event-consumer.repository';
import { getRaffleById } from '../../application/get-active-raffle';
import { executeRaffleDraw } from '../../application/execute-raffle-draw.use-case';

const EVENT_TYPE = 'raffle_closed';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

interface RaffleClosedPayload {
  raffle_id: string;
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
  console.log(`   Raffle: ${payload.raffle_id}`);

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
 * Handle raffle_closed event - TRIGGER ONLY.
 * 
 * Idempotency and validation is handled by executeRaffleDraw.
 * This consumer is a thin trigger layer only.
 */
async function handleRaffleClosed(payload: RaffleClosedPayload): Promise<void> {
  const { raffle_id } = payload;

  // Thin trigger: only verify raffle is in closed state
  // All business logic (idempotency, draw execution) handled by draw engine
  const raffle = await getRaffleById(raffle_id);
  
  if (!raffle || raffle.status !== 'closed') {
    console.log(`⚠️  Raffle ${raffle_id} not found or not closed, skipping (idempotency handled by draw engine)`);
    return;
  }

  // Trigger draw - draw engine handles all business logic
  console.log(`🎲 Triggering draw for raffle: ${raffle_id}`);
  
  const result = await executeRaffleDraw({ raffle_id });
  
  console.log(`🏆 Draw result: ${raffle_id}, winner: ${result.winning_ticket_id ?? 'none'}`);
}

if (require.main === module) {
  startRaffleClosedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}