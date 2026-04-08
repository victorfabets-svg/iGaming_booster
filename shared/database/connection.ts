import pg from 'pg';

const { Pool } = pg;

// Deterministic singleton - always initialized at module load
export const db = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Connection event handlers
db.on('connect', () => {
  console.log('[DB] New client connected to pool');
});

db.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

export async function connectWithRetry(retries = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await db.connect();
      console.log(`[DB] Connected on attempt ${attempt}`);
      client.release();
      return;
    } catch (err) {
      console.error(`[DB] Attempt ${attempt} failed`, err);

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error('DB connection failed after retries');
}