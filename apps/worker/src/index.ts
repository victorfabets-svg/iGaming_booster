/**
 * Worker Entrypoint
 * Starts all event consumers for the iGaming Booster pipeline
 */

// ============================================================
// SECURITY HARDENING - Targeted Provider Blocklist
// ============================================================

// Block forbidden database providers (not a full wipe)
const FORBIDDEN_PATTERNS = [
  "supabase",
  "SUPABASE",
  "database_url",
  "DATABASE_URL"
];

const removedKeys: string[] = [];
for (const key of Object.keys(process.env)) {
  if (FORBIDDEN_PATTERNS.some(p => key.toLowerCase().includes(p.toLowerCase()))) {
    delete process.env[key];
    removedKeys.push(key);
  }
}

if (removedKeys.length > 0) {
  console.log('🛡️ BLOCKED FORBIDDEN VARS:', removedKeys.join(', '));
}

// ============================================================

import { connectWithRetry } from '../../../shared/database/connection';

// Import all consumers
import { startProofSubmittedConsumer } from '../../api/src/domains/validation/consumers/proof-submitted.consumer';
import { startValidationAggregatorConsumer } from '../../api/src/domains/validation/consumers/validation-aggregator.consumer';
import { startProofValidatedConsumer } from '../../api/src/domains/rewards/consumers/proof-validated.consumer';
import { startRewardGrantedConsumer, CONSUMER_NAME as REWARD_GRANTED_CONSUMER_NAME } from '../../api/src/domains/raffles/consumers/reward-granted.consumer';
import { startFraudCheckRequestedConsumer } from '../../api/src/domains/fraud/consumers/fraud-check-requested.consumer';
import { startPaymentIdentifierRequestedConsumer } from '../../api/src/domains/payments/consumers/payment-identifier-requested.consumer';

async function start() {
  console.log('🔧 Connecting to database...');
  
  // Ensure database is ready before starting consumers
  await connectWithRetry();
  
  console.log('✅ Database connected');
  
  // Start all consumers - they run continuously via setInterval
  console.log('📡 Starting consumers...');
  
  // Validation domain
  await startProofSubmittedConsumer();
  console.log('  ✓ proof_submitted consumer started');
  
  await startValidationAggregatorConsumer();
  console.log('  ✓ validation_aggregator consumer started');
  
  // Fraud domain
  await startFraudCheckRequestedConsumer();
  console.log('  ✓ fraud_check_requested consumer started');
  
  // Payments domain
  await startPaymentIdentifierRequestedConsumer();
  console.log('  ✓ payment_identifier_requested consumer started');
  
  // Rewards domain
  await startProofValidatedConsumer();
  console.log('  ✓ proof_validated consumer started');
  
  // Raffles domain
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