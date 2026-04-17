// ============================================================
// SECURITY HARDENING - Env Sanitization & SSOT Enforcement
// ============================================================

// ALLOWED_ENV Whitelist - ONLY these vars can exist
const ALLOWED_ENV = ["NODE_ENV", "NEON_DB_URL", "PORT", "LOG_LEVEL"];

const removedKeys: string[] = [];
for (const key of Object.keys(process.env)) {
  if (!ALLOWED_ENV.includes(key)) {
    delete process.env[key];
    removedKeys.push(key);
  }
}

if (removedKeys.length > 0) {
  console.log('🧹 ENV SANITIZED - Removed:', removedKeys.join(', '));
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