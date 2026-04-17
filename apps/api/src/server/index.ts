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