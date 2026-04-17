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

/**
 * Get a client from the pool for transactional operations.
 * Caller MUST release the client (even on error).
 */
export async function getClient(): Promise<pg.PoolClient> {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return _db.connect();
}

/**
 * Execute a callback within a transaction.
 * Automatically commits on success, rolls back on error.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    // TASK 2: ENFORCE TIMEOUT - Set statement timeout before BEGIN
    await client.query('SET statement_timeout = 5000');
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Save event within a transaction.
 */
export async function saveEventInTransaction(
  client: pg.PoolClient,
  event_id: string,
  event_type: string,
  version: string,
  producer: string,
  correlation_id: string,
  payload: Record<string, any>
): Promise<void> {
  await client.query(
    `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [event_id, event_type, version, producer, correlation_id, JSON.stringify(payload)]
  );
}

/**
 * Log audit entry within a transaction.
 */
export async function logAuditInTransaction(
  client: pg.PoolClient,
  action: string,
  entity_type: string,
  entity_id: string,
  user_id: string | null,
  metadata: Record<string, any>
): Promise<void> {
  await client.query(
    `INSERT INTO audit.audit_logs (action, entity_type, entity_id, user_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, entity_type, entity_id, user_id, JSON.stringify(metadata)]
  );
}

export async function initDb(): Promise<void> {
  const connectionString = process.env.NEON_DB_URL;
  
  if (!connectionString) {
    throw new Error("NEON_DB_URL is required");
  }

  console.log("[DB] Initializing database connection");

  _db = new Pool({
    connectionString: connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 5000,
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
      throw new Error('Database not initialized');
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
