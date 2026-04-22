import { db } from 'shared/database/connection';

/**
 * Database-backed rate limiting function
 * Uses sliding window algorithm with PostgreSQL
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
  const windowStart = new Date(Date.now() - windowMs);

  // Count existing requests in the window
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM infra.rate_limits
     WHERE key = $1 AND created_at > $2`,
    [key, windowStart]
  );

  const count = Number(result.rows[0]?.count || 0);

  if (count >= limit) {
    return false;
  }

  // Insert new request record
  await db.query(
    `INSERT INTO infra.rate_limits (key) VALUES ($1)`,
    [key]
  );

  return true;
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