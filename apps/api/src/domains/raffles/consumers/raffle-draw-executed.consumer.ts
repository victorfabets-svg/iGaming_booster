import { fetchAndLockEvents, getRetryCount, processWithRetry, isEventProcessed, markEventAsProcessed, processEventExactlyOnce, validateEvent } from '@shared/events/event-consumer.repository';
import { getRaffleById } from '../application/get-active-raffle';
import { executeRaffleDraw } from '../use-cases/execute-raffle-draw.use-case';

const EVENT_TYPE = 'raffle_draw_executed';
const EVENT_VERSION = 'v1';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

interface RaffleDrawExecutedPayload {
  raffle_id: string;
}

export async function startRaffleDrawExecutedConsumer(): Promise<void> {
  console.log('🎰 Starting raffle_draw_executed consumer for draw execution...');

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
    console.error(`❌ Error polling ${EVENT_TYPE} events:`, error);
  }
}

async function processEvent(event: { event_id?: string; id?: string; event_type?: string; event_version?: string; version?: string; payload: unknown }): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RaffleDrawExecutedPayload;
  
  // STEP 1: Validate event type, version, and payload BEFORE processing
  const validationError = validateEvent(
    event as any,
    EVENT_TYPE,
    EVENT_VERSION,
    ['raffle_id']
  );
  
  if (validationError) {
    console.log(`🚫 Invalid event ${eventId}: ${validationError.code} - ${validationError.message}`);
    // Invalid events are skipped (not retried) to prevent poison messages
    return;
  }

  // STEP 2: EXACTLY-ONCE: Check if already processed before attempting
  const alreadyProcessed = await isEventProcessed(eventId);
  if (alreadyProcessed) {
    console.log(`⏭️  Event ${eventId} already processed, skipping (exactly-once)`);
    return;
  }

  const retryCount = await getRetryCount(eventId);

  console.log(`🎰 Processing ${EVENT_TYPE} event: ${eventId} (retry: ${retryCount})`);
  console.log(`   Raffle: ${payload.raffle_id}`);

  // STEP 3: Wrap in transaction with idempotency record
  const result = await processEventExactlyOnce(eventId, async () => {
    await handleRaffleDrawExecuted(payload);
  });

  if (result.skipped) {
    console.log(`⏭️  Event ${eventId} skipped - already processed`);
  } else if (result.success) {
    console.log(`✅ Event ${eventId} processed exactly-once`);
  } else {
    console.log(`📬 Event ${eventId} failed after retries`);
  }
}

/**
 * Handle raffle_draw_executed event - TRIGGER ONLY.
 * 
 * Idempotency and validation is handled by executeRaffleDraw.
 * This consumer is a thin trigger layer only.
 */
async function handleRaffleDrawExecuted(payload: RaffleDrawExecutedPayload): Promise<void> {
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
  startRaffleDrawExecutedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}