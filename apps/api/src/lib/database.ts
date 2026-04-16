// Single database connection - re-exports from shared/database/connection
// This file now acts as a thin compatibility layer

import { pool, query, queryOne, execute, withTransaction, closePool, getDb } from '../../../../shared/database/connection';

// Re-export everything for backward compatibility
export { pool, query, queryOne, execute, withTransaction, closePool, getDb };
export { getDb as getPool };