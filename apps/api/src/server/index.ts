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
import { config } from '../../../../shared/config/env';
import { connectWithRetry, getDb } from '../../../../shared/database/connection';
import { startStuckEventRecovery } from '../../../../shared/events/event-consumer.repository';

async function start() {
  // Connect to database - MUST succeed or app fails
  try {
    console.log('[DB] Attempting to connect to database...');
    await connectWithRetry();
    console.log('[DB] Connection successful');
  } catch (error) {
    console.error('[DB] Connection failed');
    process.exit(1);
  }

  // Start stuck event recovery globally (runs once)
  startStuckEventRecovery();

  const app = buildApp();

  const port = config.apiPort;

  try {
    await app.listen({ port });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});