import { buildApp } from './app';
import { config } from '../../../../shared/config/env';
import { connectWithRetry, getDb } from '../../../../shared/database/connection';
import { startStuckEventRecovery } from '../../../../shared/events/event-consumer.repository';

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
  const host = config.apiHost;

  // FAIL FAST: Verify port is defined
  if (!port) {
    throw new Error("PORT not defined");
  }

  console.log(`Starting server on ${host}:${port}...`);

  try {
    await app.listen({ port, host });
    console.log(`Server running on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});