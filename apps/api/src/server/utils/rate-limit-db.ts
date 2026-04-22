import { db } from '@shared/database/connection';

/**
 * Database-backed rate limiting function
 * Uses sliding window algorithm with PostgreSQL and advisory lock for atomic operations
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limit exceeded
 */
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Acquire advisory lock for this key to prevent concurrent bypass
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [key]
    );

    const windowStart = new Date(Date.now() - windowMs);

    // Count existing requests in the window
    const result = await client.query(
      `SELECT COUNT(*) FROM infra.rate_limits
       WHERE key = $1 AND created_at > $2`,
      [key, windowStart]
    );

    const count = Number(result.rows[0]?.count || 0);

    if (count >= limit) {
      await client.query('ROLLBACK');
      return false;
    }

    // Insert new request record
    await client.query(
      `INSERT INTO infra.rate_limits (key) VALUES ($1)`,
      [key]
    );

    await client.query('COMMIT');
    return true;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cleanup old rate limit entries
 * Should be called periodically to prevent table bloat
 * @param olderThanMs - Remove entries older than this many milliseconds (default: 5 minutes)
 */
export async function cleanupRateLimits(olderThanMs: number = 300000): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs);
  await db.query(
    `DELETE FROM infra.rate_limits WHERE created_at < $1`,
    [cutoff]
  );
}