import { buildApp } from './app';
import { config } from '../shared/config/env';
import { connectWithRetry } from '../../../shared/database/connection';

async function start() {
  try {
    console.log('[DB] Attempting to connect to database...');
    await connectWithRetry();
  } catch (error) {
    console.error('[DB] Failed to connect to database:', error);
    process.exit(1);
  }

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

start();