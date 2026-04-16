import pg from 'pg';

// Use the Pool from the imported module
const Pool = pg.Pool;

// TASK 1 — GLOBAL SINGLETON GUARD
// Use global to survive module reload and ensure single pool instance
const globalAny = global as any;

if (!globalAny.__DB_POOL__) {
  globalAny.__DB_POOL__ = new Pool({
    connectionString: process.env.NEON_DB_URL!,
    ssl: true,
  });
}

// Assert on startup
console.assert(globalAny.__DB_POOL__, "DB not initialized");

export const db = globalAny.__DB_POOL__;

export function getDb(): pg.Pool {
  return db;
}

/**
 * Get a client from the pool for transactional operations.
 * Caller MUST release the client (even on error).
 */
export async function getClient(): Promise<pg.PoolClient> {
  return db.connect();
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
  // Test the connection (pool already initialized via global singleton)
  try {
    const result = await db.query('SELECT NOW()');
    console.log('[DB] Connection established:', result.rows[0].now);
  } catch (error) {
    console.error('[DB] Failed to connect:', error);
    throw error;
  }
}

// Re-export pool for backward compatibility using global singleton
export function getPool(): pg.Pool {
  return db;
}

// Legacy exports for backward compatibility - use global singleton
export const pool = {
  query: db.query.bind(db),
  end: () => db.end(),
  connect: db.connect.bind(db)
};

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await db.query(text, params);
  return result.rows;
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await db.query(text, params);
  return result.rows[0] || null;
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await db.query(text, params);
  return result.rowCount || 0;
}

export async function closePool(): Promise<void> {
  await db.end();
}

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
