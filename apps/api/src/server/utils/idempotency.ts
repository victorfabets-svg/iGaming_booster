import { db } from 'shared/database/connection';
import { createLogger } from './logger';

// Module-level logger with static context
const logger = createLogger({ module: 'idempotency' });

// Timeout in milliseconds before allowing retry (30 seconds)
const IDEMPOTENCY_TIMEOUT_MS = 30000;

interface IdempotencyRecord {
  response: Record<string, unknown> | null;
  status: string;
  created_at: Date | null;
}

/**
 * Reserve idempotency key atomically - only one request can acquire
 * @returns { acquired: true } if this request got the lock, { acquired: false } otherwise
 */
export async function reserveIdempotency(key: string): Promise<{ acquired: boolean }> {
  try {
    await db.query(
      `INSERT INTO infra.idempotency_keys (key, status)
       VALUES ($1, 'pending')
       ON CONFLICT (key) DO NOTHING`,
      [key]
    );
    return { acquired: true };
  } catch {
    return { acquired: false };
  }
}

/**
 * Get existing idempotency record
 * @returns response and status if key exists, null otherwise
 */
export async function getIdempotency(key: string): Promise<IdempotencyRecord | null> {
  const result = await db.query<IdempotencyRecord>(
    `SELECT response, status, created_at FROM infra.idempotency_keys WHERE key = $1`,
    [key]
  );
  return result.rows[0] || null;
}

/**
 * Release a stale idempotency key (for recovery after crash)
 * @returns true if key was released
 */
export async function releaseStaleIdempotency(key: string): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM infra.idempotency_keys 
     WHERE key = $1 
       AND status = 'pending' 
       AND created_at < NOW() - INTERVAL '30 seconds'`,
    [key]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if a pending key is stale (older than timeout)
 */
export function isIdempotencyStale(record: IdempotencyRecord | null): boolean {
  if (!record || record.status !== 'pending' || !record.created_at) {
    return false;
  }
  const age = Date.now() - new Date(record.created_at).getTime();
  return age > IDEMPOTENCY_TIMEOUT_MS;
}

/**
 * Cleanup old idempotency keys to prevent unbounded growth
 * @param olderThanMs - Delete keys older than this many milliseconds (default 24h)
 */
export async function cleanupIdempotency(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  
  const result = await db.query(
    `DELETE FROM infra.idempotency_keys
     WHERE created_at < $1`,
    [cutoff]
  );
  
  const deleted = result.rowCount ?? 0;
  if (deleted > 0) {
    logger.info({
      event: 'idempotency_cleanup_executed',
      deleted_count: deleted,
      cutoff: cutoff.toISOString()
    });
  }
  
  return deleted;
}

/**
 * Complete idempotency by saving the final response
 */
export async function completeIdempotency(
  key: string,
  response: Record<string, unknown>
): Promise<void> {
  try {
    await db.query(
      `UPDATE infra.idempotency_keys
       SET response = $2, status = 'done'
       WHERE key = $1 AND status = 'pending'`,
      [key, JSON.stringify(response)]
    );
  } catch (err) {
    logger.error({ event: 'idempotency_complete_failed', error: String(err) });
  }
}

/**
 * Legacy - check if an idempotency key was previously used
 * @deprecated Use reserveIdempotency + getIdempotency instead
 */
export async function checkIdempotency(key: string): Promise<Record<string, unknown> | null> {
  const record = await getIdempotency(key);
  return record?.status === 'done' ? record.response : null;
}

/**
 * Legacy - save response for idempotency key
 * @deprecated Use reserveIdempotency + completeIdempotency instead
 */
export async function saveIdempotency(
  key: string,
  response: Record<string, unknown>
): Promise<void> {
  await completeIdempotency(key, response);
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKey(headers: Record<string, unknown>): string | null {
  return (headers['idempotency-key'] as string) || null;
}