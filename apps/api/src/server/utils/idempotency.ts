import { db } from 'shared/database/connection';

/**
 * Check if an idempotency key was previously used
 * @returns Cached response if key exists, null otherwise
 */
export async function checkIdempotency(key: string): Promise<Record<string, unknown> | null> {
  const result = await db.query<{ response: Record<string, unknown> }>(
    `SELECT response FROM infra.idempotency_keys WHERE key = $1`,
    [key]
  );
  return result.rows[0]?.response || null;
}

/**
 * Save response for idempotency key
 * Uses ON CONFLICT to handle race conditions
 */
export async function saveIdempotency(
  key: string,
  response: Record<string, unknown>
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO infra.idempotency_keys (key, response)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(response)]
    );
  } catch (err) {
    // Log but don't fail the main flow
    console.error('[IDEMPOTENCY] Failed to save:', err);
  }
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKey(headers: Record<string, unknown>): string | null {
  return (headers['idempotency-key'] as string) || null;
}