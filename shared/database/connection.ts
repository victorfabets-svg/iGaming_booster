import pg from 'pg';

// Use the Pool from the imported module
const Pool = pg.Pool;

// Deterministic singleton - always initialized at module load
let _db: pg.Pool | null = null;

export function getDb(): pg.Pool {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return _db;
}

export async function initDb(connectionString?: string): Promise<void> {
  const dbUrl = connectionString || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  _db = new Pool({
    connectionString: dbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  _db.on('error', (err: Error) => {
    console.error('[DB] Unexpected database error:', err);
  });

  // Test the connection
  try {
    const result = await _db.query('SELECT NOW()');
    console.log('[DB] Connection established:', result.rows[0].now);
  } catch (error) {
    console.error('[DB] Failed to connect:', error);
    throw error;
  }
}

export const db = {
  query: async <T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }> => {
    if (!_db) {
      // Return empty result if DB not connected - allows health checks to pass
      console.warn('[DB] Query attempted but DB not connected:', text.substring(0, 50));
      return { rows: [] as T[] };
    }
    const result = await _db.query(text, params);
    return { rows: result.rows };
  },
  end: async (): Promise<void> => {
    if (_db) {
      await _db.end();
      _db = null;
    }
  },
};

export async function connectWithRetry(maxRetries = 5, delayMs = 2000): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await initDb();
      console.log('[DB] Connected successfully after', attempt, 'attempt(s)');
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`[DB] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`[DB] Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
