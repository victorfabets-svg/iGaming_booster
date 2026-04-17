/**
 * Worker Entrypoint
 * Starts all event consumers for the iGaming Booster pipeline
 */

// ============================================================
// SECURITY KILL SWITCH - Block forbidden env vars
// ============================================================
const forbidden = Object.keys(process.env).filter(k =>
  k.toLowerCase().includes('supabase') ||
  k === 'DATABASE_URL'
);

if (forbidden.length > 0) {
  console.error('🚨 FORBIDDEN ENV DETECTED:', forbidden);
  process.exit(1);
}

// Force clean env - delete any remaining forbidden vars
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_DB_URL;
delete process.env.Supabase_DB_URL;
// ============================================================

import { connectWithRetry } from '../../../shared/database/connection';

// Import all consumers
import { startProofSubmittedConsumer } from '../../api/src/domains/validation/consumers/proof-submitted.consumer';
import { startProofValidatedConsumer } from '../../api/src/domains/rewards/consumers/proof-validated.consumer';
import { startRewardGrantedConsumer, CONSUMER_NAME as REWARD_GRANTED_CONSUMER_NAME } from '../../api/src/domains/raffles/consumers/reward-granted.consumer';

async function start() {
  console.log('🔧 Connecting to database...');
  
  // Ensure database is ready before starting consumers
  await connectWithRetry();
  
  console.log('✅ Database connected');
  
  // Start all consumers - they run continuously via setInterval
  console.log('📡 Starting consumers...');
  
  await startProofSubmittedConsumer();
  console.log('  ✓ proof_submitted consumer started');
  
  await startProofValidatedConsumer();
  console.log('  ✓ proof_validated consumer started');
  
  await startRewardGrantedConsumer();
  console.log('  ✓ reward_granted consumer started');
  console.log('    consumer_name:', REWARD_GRANTED_CONSUMER_NAME);
  
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