"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startProofValidatedConsumer = startProofValidatedConsumer;
const event_consumer_repository_1 = require("../../../shared/events/event-consumer.repository");
const process_reward_use_case_1 = require("../../rewards/use-cases/process-reward.use-case");
const EVENT_TYPE = 'proof_validated';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;
async function startProofValidatedConsumer() {
    console.log('🔄 Starting proof_validated consumer...');
    // Ensure processed_events table exists
    await (0, event_consumer_repository_1.ensureProcessedEventsTable)();
    console.log('✅ Processed events tracking ready');
    // Initial poll
    await pollEvents();
    // Set up interval for continuous polling
    setInterval(async () => {
        await pollEvents();
    }, POLL_INTERVAL_MS);
}
async function pollEvents() {
    try {
        const events = await (0, event_consumer_repository_1.fetchUnprocessedEvents)(EVENT_TYPE, BATCH_SIZE);
        if (events.length === 0) {
            return;
        }
        console.log(`📬 Found ${events.length} unprocessed ${EVENT_TYPE} events`);
        for (const event of events) {
            await processEvent(event);
        }
    }
    catch (error) {
        console.error('❌ Error polling events:', error);
    }
}
async function processEvent(event) {
    const eventId = event.id;
    const payload = event.payload;
    console.log(`\n🔔 Processing event: ${eventId}`);
    console.log(`   Type: ${EVENT_TYPE}`);
    console.log(`   Proof ID: ${payload.proof_id}, Status: ${payload.status}`);
    try {
        await (0, process_reward_use_case_1.processReward)(payload);
        // Mark event as processed after successful handling
        await (0, event_consumer_repository_1.markEventProcessed)(eventId);
        console.log(`✅ Event ${eventId} processed and marked`);
    }
    catch (error) {
        console.error(`❌ Failed to process event ${eventId}:`, error);
        // Do not mark as processed on failure - will retry
    }
}
// For running as standalone script
if (require.main === module) {
    startProofValidatedConsumer().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=proof-validated.consumer.js.map