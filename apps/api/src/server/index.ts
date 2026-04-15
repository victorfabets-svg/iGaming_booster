import { buildApp } from './app';
import { config } from '../../../../shared/config/env';
import { connectWithRetry, getDb } from '../../../../shared/database/connection';
import { startStuckEventRecovery } from '../../../../shared/events/event-consumer.repository';

async function start() {
  // Try to connect to database, but allow server to start even if it fails
  try {
    console.log('[DB] Attempting to connect to database...');
    await connectWithRetry();
  } catch (error) {
    console.error('[DB] Warning: Database connection failed, continuing anyway:', error);
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