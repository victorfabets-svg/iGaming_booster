// In-memory rate limiter using sliding window algorithm
const store = new Map<string, number[]>();

/**
 * Rate limiting function that applies a sliding window algorithm
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limit exceeded
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (!store.has(key)) {
    store.set(key, []);
  }

  const timestamps = store.get(key)!.filter(t => now - t < windowMs);

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return true;
}