// Primary database connection - singleton for the application
import pg from 'pg';

const { Pool } = pg;

// Validate required environment variables
if (!process.env.NEON_DB_URL) {
  throw new Error("NEON_DB_URL is not set");
}

// Deterministic singleton - always initialized at module load
export const db = new Pool({
  connectionString: process.env.NEON_DB_URL!,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Getter for backward compatibility
export function getDb(): pg.Pool { return db; }
export function getClient(): Promise<pg.PoolClient> { return db.connect(); }
export async function initDb(connectionString?: string): Promise<void> { /* no-op: already initialized */ }

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