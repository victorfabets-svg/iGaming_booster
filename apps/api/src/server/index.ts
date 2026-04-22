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

import { buildApp } from './app';
import { config, NEON_DB_URL } from '../../../../shared/config/env';
import { connectWithRetry, getDb, closePool } from '../../../../shared/database/connection';
import { startStuckEventRecovery, stopStuckEventRecovery } from '../../../../shared/events/event-consumer.repository';
import { setDbHealth } from './state';

// Global app reference for graceful shutdown
let app: ReturnType<typeof buildApp> | null = null;

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

    // Stop accepting new connections and close gracefully
    if (app) {
      await app.close();
      console.log(JSON.stringify({ event: 'server_closed' }));
    }

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

// Structured DB audit log (sanitized - no credentials)
let dbHostInfo: Record<string, unknown> = {};
if (NEON_DB_URL) {
  try {
    const dbUrlParsed = new URL(NEON_DB_URL);
    dbHostInfo = {
      host: dbUrlParsed.hostname,
      port: dbUrlParsed.port || "5432",
      ssl: dbUrlParsed.searchParams?.get("sslmode") ?? null,
    };
  } catch {
    dbHostInfo = { host: 'invalid' };
  }
}
console.log(JSON.stringify({
  event: "db_connection_config",
  ...dbHostInfo,
  env: process.env.NODE_ENV,
  allowlist: process.env.ALLOWED_NEON_HOSTS ?? null,
  timestamp: new Date().toISOString()
}));

async function start() {
  console.log('='.repeat(50));
  console.log('API BOOTING');
  console.log('='.repeat(50));

  // Connect to database - gracefully handle failures
  try {
    console.log('[DB] Attempting to connect to database...');
    await connectWithRetry();
    console.log('[DB] ✅ Connection successful');
    setDbHealth(true);
  } catch (error) {
    console.error('[DB] ❌ DB failed, continuing in degraded mode');
    setDbHealth(false);
  }

  // Start stuck event recovery globally (runs once)
  startStuckEventRecovery();

  app = await buildApp();

  const port = config.apiPort;

  try {
    await app.listen({ port: port, host: '0.0.0.0' });
    console.log('API LISTENING 3000');
    console.log(`✅ API LISTENING on port ${port}`);
    console.log(`🌍 http://localhost:${port}`);
    console.log('='.repeat(50));
  } catch (err) {
    console.error('❌ API FAILED TO START:', err);
    app.log.error(err);
    process.exit(1);
  }
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});