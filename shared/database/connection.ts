import pg from 'pg';

const { Pool } = pg;

// Singleton pool - always initialized
export let db: Pool;

export function initDatabase(connectionString: string): void {
  db = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  db.on('connect', () => {
    console.log('[DB] New client connected to pool');
  });

  db.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err);
  });
}

export async function connectWithRetry(
  connectionString: string,
  retries = 5,
  delayMs = 2000
): Promise<void> {
  // Initialize pool if not exists
  if (!db) {
    initDatabase(connectionString);
  }

  // Retry connection
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await db.connect();
      console.log(`[DB] Connected successfully on attempt ${attempt}`);
      client.release();
      return;
    } catch (error) {
      console.error(`[DB] Connection attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt < retries) {
        console.log(`[DB] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`[DB] Failed to connect after ${retries} attempts`);
}