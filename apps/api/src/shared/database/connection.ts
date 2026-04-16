// Re-export from shared/database/connection - single source of truth
// Using named imports to ensure proper re-export
import { db as _db, getDb, getClient, withTransaction, initDb, connectWithRetry, query, queryOne, execute, closePool, getPool, pool } from 'shared/database/connection';

// Export db object for backward compatibility (has .query method)
export const db = _db;

// Export all other functions
export { getDb, getClient, withTransaction, initDb, connectWithRetry, query, queryOne, execute, closePool, getPool, pool };