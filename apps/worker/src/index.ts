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

import { connectWithRetry, closePool } from '../../../shared/database/connection';
import { startStuckEventRecovery, stopStuckEventRecovery } from '../../../shared/events/event-consumer.repository';

// Import all consumers
import { startProofSubmittedConsumer } from '../../api/src/domains/validation/consumers/proof-submitted.consumer';
import { startValidationAggregatorConsumer } from '../../api/src/domains/validation/consumers/validation-aggregator.consumer';
import { startProofValidatedConsumer } from '../../api/src/domains/rewards/consumers/proof-validated.consumer';
import { startRewardGrantedConsumer, CONSUMER_NAME as REWARD_GRANTED_CONSUMER_NAME } from '../../api/src/domains/raffles/consumers/reward-granted.consumer';
import { startFraudCheckRequestedConsumer } from '../../api/src/domains/fraud/consumers/fraud-check-requested.consumer';
import { startPaymentIdentifierRequestedConsumer } from '../../api/src/domains/payments/consumers/payment-identifier-requested.consumer';

// Track database connection state
let dbConnected = false;

// Force exit timeout - prevents hanging on failed shutdown
const FORCE_EXIT_TIMEOUT_MS = 10000;

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({
    event: 'shutdown_started',
    signal
  }));

  // Set force exit timeout
  const forceExitTimer = setTimeout(() => {
    console.log(JSON.stringify({
      event: 'shutdown_timeout',
      message: 'Force exiting after timeout'
    }));
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);

  try {
    // Stop stuck event recovery interval
    stopStuckEventRecovery();

    // Close database pool
    await closePool();
    console.log(JSON.stringify({ event: 'db_pool_closed' }));

    clearTimeout(forceExitTimer);

    console.log(JSON.stringify({
      event: 'shutdown_completed'
    }));

    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimer);
    console.log(JSON.stringify({
      event: 'shutdown_error',
      error: err instanceof Error ? err.message : String(err)
    }));
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  console.log('🔧 Connecting to database...');
  
  // Try to connect to database - allow degraded mode if it fails
  try {
    await connectWithRetry();
    dbConnected = true;
    console.log('✅ Database connected');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('⚠️ DB connection failed - continuing in degraded mode:', errorMessage);
    dbConnected = false;
  }
  
  // Start all consumers - they run continuously via setInterval
  console.log('📡 Starting consumers...');
  
  // Validation domain
  try {
    await startProofSubmittedConsumer();
    console.log('  ✓ proof_submitted consumer started');
  } catch (err) {
    console.error('  ✗ proof_submitted consumer failed:', err instanceof Error ? err.message : String(err));
  }
  
  try {
    await startValidationAggregatorConsumer();
    console.log('  ✓ validation_aggregator consumer started');
  } catch (err) {
    console.error('  ✗ validation_aggregator consumer failed:', err instanceof Error ? err.message : String(err));
  }
  
  // Fraud domain
  try {
    await startFraudCheckRequestedConsumer();
    console.log('  ✓ fraud_check_requested consumer started');
  } catch (err) {
    console.error('  ✗ fraud_check_requested consumer failed:', err instanceof Error ? err.message : String(err));
  }
  
  // Payments domain
  try {
    await startPaymentIdentifierRequestedConsumer();
    console.log('  ✓ payment_identifier_requested consumer started');
  } catch (err) {
    console.error('  ✗ payment_identifier_requested consumer failed:', err instanceof Error ? err.message : String(err));
  }
  
  // Rewards domain
  try {
    await startProofValidatedConsumer();
    console.log('  ✓ proof_validated consumer started');
  } catch (err) {
    console.error('  ✗ proof_validated consumer failed:', err instanceof Error ? err.message : String(err));
  }
  
  // Raffles domain
  try {
    await startRewardGrantedConsumer();
    console.log('  ✓ reward_granted consumer started');
    console.log('    consumer_name:', REWARD_GRANTED_CONSUMER_NAME);
  } catch (err) {
    console.error('  ✗ reward_granted consumer failed:', err instanceof Error ? err.message : String(err));
  }
  
  // Determine final state
  if (dbConnected) {
    console.log('\n🚀 Worker started - all consumers polling for events\n');
  } else {
    console.log('\n⚠️ Worker started in DEGRADED MODE (no database connection)\n');
  }
  
  // Keep the process alive - prevent exit
  // The consumers use setInterval for continuous polling
  // Also add a fallback interval to ensure process stays alive
  setInterval(() => {
    // Periodic health check logging
    console.log(`[Health] Worker running (db: ${dbConnected ? 'connected' : 'degraded'})`);
  }, 30000); // Every 30 seconds
}

// Handle uncaught errors - DON'T exit, just log
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught exception:', error.message);
  // Don't exit - keep worker alive
});

process.on('unhandledRejection', (reason) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  console.error('⚠️ Unhandled rejection:', errorMessage);
  // Don't exit - keep worker alive
});

// Start the worker
start();