import { fetchUnprocessedEvents, markEventProcessed, ensureProcessedEventsTable, acquireEventLock, processEventWithRetry, ensureDlqTable, Event } from '../../../../../../shared/events/event-consumer.repository';
import { processReward } from '../../rewards/use-cases/process-reward.use-case';

const EVENT_TYPE = 'proof_validated';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startProofValidatedConsumer(): Promise<void> {
  console.log('🔄 Starting proof_validated consumer...');

  // Ensure processed_events table exists
  await ensureProcessedEventsTable();
  await ensureDlqTable();
  console.log('✅ Processed events & DLQ tables ready');

  // Initial poll
  await pollEvents();

  // Set up interval for continuous polling
  setInterval(async () => {
    await pollEvents();
  }, POLL_INTERVAL_MS);
}

async function pollEvents(): Promise<void> {
  try {
    const allEvents = await fetchUnprocessedEvents(BATCH_SIZE);
    
    // Filter by event type
    const events = allEvents.filter(e => e.event_type === EVENT_TYPE);

    if (events.length === 0) {
      return;
    }

    console.log(`📬 Found ${events.length} unprocessed ${EVENT_TYPE} events`);

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

  console.log(`\n🔔 Processing event: ${eventId}`);
  console.log(`   Type: ${EVENT_TYPE}`);
  console.log(`   Proof ID: ${payload.proof_id}, Status: ${payload.status}`);

  // ============================================================================
  // TASK 1: EVENT LOCK - Check if already processed, if yes → SKIP
  // ============================================================================
  
  // Try to acquire lock - if fails, event was already processed
  const lockAcquired = await acquireEventLock(eventId);
  
  if (!lockAcquired) {
    console.log(`⏭️ Event ${eventId} already processed - skipping`);
    return;
  }

  // ============================================================================
  // TASK 3: RETRY STRATEGY - With DLQ fallback
  // ============================================================================
  
  const success = await processEventWithRetry(
    eventId,
    payload,
    async () => {
      // This is the actual business logic - wrapped with retry
      await processReward(payload);
    }
  );

  if (success) {
    console.log(`✅ Event ${eventId} processed successfully`);
  } else {
    console.log(`📬 Event ${eventId} sent to DLQ after max retries`);
  }
}

// For running as standalone script
if (require.main === module) {
  startProofValidatedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
