import { fetchAndLockEvents, markEventProcessed, incrementRetryCount, processWithRetry, runEventMigrations, getRetryCount, Event } from '../../../../../../shared/events/event-consumer.repository';
import { processReward } from '../../rewards/use-cases/process-reward.use-case';

const EVENT_TYPE = 'proof_validated';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startProofValidatedConsumer(): Promise<void> {
  console.log('🔄 Starting proof_validated consumer...');

  // Run migrations to create tables and columns
  await runEventMigrations();
  console.log('✅ Event migrations complete');

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

    console.log(`📬 Found ${events.length} ${EVENT_TYPE} events (with row lock)`);

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    console.error('❌ Error polling events:', error);
  }
}

interface ProofValidatedPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
  validation_id: string;
  status: string;
  confidence_score: number;
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as ProofValidatedPayload;
  const retryCount = await getRetryCount(eventId);

  console.log(`\n🔔 Processing event: ${eventId} (retry: ${retryCount})`);
  console.log(`   Type: ${EVENT_TYPE}, Proof ID: ${payload.proof_id}, Status: ${payload.status}`);

  // Use retry logic - increments retry_count on each failure
  // After 3 retries → goes to DLQ
  const success = await processWithRetry(
    eventId,
    payload,
    async () => {
      await processReward(payload);
    }
  );

  if (success) {
    console.log(`✅ Event ${eventId} processed successfully`);
  } else {
    console.log(`📬 Event ${eventId} sent to DLQ after 3 retries`);
  }
}

// For running as standalone script
if (require.main === module) {
  startProofValidatedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
