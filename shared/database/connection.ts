import pg from 'pg';
import { 
  isCircuitOpen, recordFailure, recordSuccess, CircuitOpenError, DbPoolExhaustedError,
  incrementDbClients, decrementDbClients, getActiveDbClients 
} from './db-circuit';
import { logger } from '../observability/logger';

// Re-export types
export type { Pool, PoolClient } from 'pg';

/**
 * ============================================================================
 * ⚠️ DATABASE CONNECTION - SAFE USAGE PATTERNS
 * ============================================================================
 * 
 * Use ONLY these patterns for database access:
 * 
 * 1. runWithClient(fn)     - For single queries with auto-release
 * 2. withTransaction(fn)  - For transactional operations
 * 3. db.query()           - For simple queries (uses internal pool)
 * 
 * DO NOT use:
 * - getClient()           - Deprecated, will be removed
 * - client.query() directly outside wrappers
 * 
 * Example - CORRECT:
 *   const result = await runWithClient(async (client) => {
 *     return await client.query('SELECT * FROM users WHERE id = $1', [id]);
 *   });
 * 
 * Example - INCORRECT (causes leaks):
 *   const client = await getClient();
 *   try { await client.query('...'); } 
 *   finally { client.release(); }
 * 
 * ============================================================================
 */

// Safe usage mode - 'true' blocks getClient(), 'warn' logs extra context
const STRICT_DB = process.env.STRICT_DB;

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

export function getPool(): pg.Pool {
  return _db!;
}

export function pool(): pg.Pool {
  return _db!;
}

/**
 * ⚠️ DEPRECATED - Use runWithClient() or withTransaction() instead.
 * 
 * Get a client from the pool for transactional operations.
 * Caller MUST release the client (even on error).
 * 
 * @deprecated This function will be removed in a future version.
 */
export async function getClient(): Promise<pg.PoolClient> {
  // Log every usage for auditing (timestamp auto-injected by logger)
  logger.error({
    event: 'unsafe_db_usage_detected',
    context: 'database',
    message: 'getClient() called - use runWithClient() or withTransaction() instead',
    strict_mode: STRICT_DB,
    ...(STRICT_DB === 'warn' && { stack: new Error().stack })
  });

  // Block if STRICT_DB=true
  if (STRICT_DB === 'true') {
    throw new Error('getClient() is disabled. Use runWithClient() or withTransaction() instead.');
  }

  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  return acquireClient();
}

/**
 * Execute a function with a database client.
 * Automatically acquires a client from the pool and releases it when done.
 * This eliminates the risk of client leaks from manual release() calls.
 * 
 * @param fn - Function that receives the client and returns a promise
 * @returns The result of the function
 */
export async function runWithClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await acquireClient();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Execute a callback within a transaction.
 * Automatically commits on success, rolls back on error.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  return runWithClient(async (client) => {
    try {
      await client.query('SET statement_timeout = 5000');
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
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
    // Fast fail if circuit is open
    if (isCircuitOpen()) {
      throw new CircuitOpenError();
    }
    
    if (!_db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const result = await _db.query(text, params);
      recordSuccess();
      return { rows: result.rows };
    } catch (error) {
      recordFailure();
      throw error;
    }
  },
  connect: async (): Promise<pg.PoolClient> => {
    return acquireClient();
  },
  end: async (): Promise<void> => {
    if (_db) {
      await _db.end();
      _db = null;
    }
  },
};

/**
 * Shared function to acquire a DB client with circuit breaker + pool protection.
 * Tracks active clients and wraps release to prevent leaks.
 */
async function acquireClient(): Promise<pg.PoolClient> {
  // Fast fail if circuit is open
  if (isCircuitOpen()) {
    throw new CircuitOpenError();
  }

  // Check pool capacity
  if (!incrementDbClients()) {
    console.log(JSON.stringify({
      event: 'db_pool_exhausted',
      active_clients: getActiveDbClients()
    }));
    throw new DbPoolExhaustedError();
  }

  if (!_db) {
    decrementDbClients();
    throw new Error('Database not initialized');
  }

  try {
    const client = await _db.connect();

    const originalRelease = client.release.bind(client);
    let released = false;

    // Wrap release to track return and prevent double-release
    client.release = () => {
      if (released) {
        return;
      }
      released = true;
      decrementDbClients();
      return originalRelease();
    };

    recordSuccess();
    return client;
  } catch (err) {
    decrementDbClients();
    recordFailure();
    throw err;
  }
}

// Legacy exports for compatibility
export async function query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
  return db.query<T>(text, params);
}

export async function queryOne<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await db.query<T>(text, params);
  return result.rows[0] || null;
}

export async function execute(text: string, params?: unknown[]): Promise<void> {
  await db.query(text, params);
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
