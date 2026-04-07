import { fetchUnprocessedEvents, markEventProcessed, ensureProcessedEventsTable } from '../../../shared/events/event-consumer.repository';
import { processProofSubmitted, ProofSubmittedEventPayload } from '../../use-cases/process-proof-submitted.use-case';

const EVENT_TYPE = 'proof_submitted';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export async function startProofSubmittedConsumer(): Promise<void> {
  console.log('🔄 Starting proof_submitted consumer...');
  
  // Ensure processed_events table exists
  await ensureProcessedEventsTable();
  console.log('✅ Processed events tracking ready');

  // Initial poll
  await pollEvents();

  // Set up interval for continuous polling
  setInterval(async () => {
    await pollEvents();
  }, POLL_INTERVAL_MS);
}

async function pollEvents(): Promise<void> {
  try {
    const events = await fetchUnprocessedEvents(EVENT_TYPE, BATCH_SIZE);
    
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

async function processEvent(event: { id: string; payload: Record<string, unknown> }): Promise<void> {
  const eventId = event.id;
  const payload = event.payload as ProofSubmittedEventPayload;

  console.log(`\n🔔 Processing event: ${eventId}`);
  console.log(`   Type: ${EVENT_TYPE}`);
  console.log(`   Proof ID: ${payload.proof_id}`);

  try {
    await processProofSubmitted(payload);
    
    // Mark event as processed after successful handling
    await markEventProcessed(eventId);
    
    console.log(`✅ Event ${eventId} processed and marked`);
  } catch (error) {
    console.error(`❌ Failed to process event ${eventId}:`, error);
    // Do not mark as processed on failure - will retry
  }
}

// For running as standalone script
if (require.main === module) {
  startProofSubmittedConsumer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}