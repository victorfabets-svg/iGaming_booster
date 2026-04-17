/**
 * Worker Entrypoint
 * Starts all event consumers for the iGaming Booster pipeline
 */

import { connectWithRetry } from '../../../shared/database/connection';

// Import all consumers
import { startRewardGrantedConsumer } from '../../api/src/domains/raffles/consumers/reward-granted.consumer';
import { startProofValidatedConsumer } from '../../api/src/domains/rewards/consumers/proof-validated.consumer';
import { startProofSubmittedConsumer } from '../../api/src/domains/validation/consumers/proof-submitted.consumer';
import { startRaffleDrawExecutedConsumer } from '../../api/src/domains/raffles/consumers/raffle-draw-executed.consumer';

async function start() {
  // Validate environment variables
  const mode = process.env.RUNTIME_ENV; // 'ci' | 'preaudit'

  if (!process.env.NEON_DB_URL) {
    throw new Error("NEON_DB_URL missing");
  }

  if (
    mode === 'preaudit' &&
    process.env.NEON_DB_URL.includes("localhost")
  ) {
    throw new Error("INVALID DB: localhost not allowed in preaudit");
  }

  console.log('🔧 Connecting to database...');
  
  // Ensure database is ready before starting consumers
  await connectWithRetry();
  
  console.log('✅ Database connected');
  
  // Start all consumers - they run continuously via setInterval
  console.log('📡 Starting consumers...');
  
  startProofSubmittedConsumer();
  console.log('  ✓ proof_submitted consumer started');
  
  startProofValidatedConsumer();
  console.log('  ✓ proof_validated consumer started');
  
  startRewardGrantedConsumer();
  console.log('  ✓ reward_granted consumer started');
  
  startRaffleDrawExecutedConsumer();
  console.log('  ✓ raffle_draw_executed consumer started');
  
  console.log('\n🚀 Worker started - all consumers polling for events\n');
  
  // Keep the process alive
  // The consumers use setInterval for continuous polling
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
  process.exit(1);
});

// Start the worker
start();