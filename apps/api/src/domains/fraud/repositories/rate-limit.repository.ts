import { pool, queryOne } from '../../../lib/database';

export interface RateLimit {
  id: string;
  user_id: string;
  limit_type: string;
  count: number;
  window_start: Date;
  window_end: Date;
}

export interface CheckRateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: Date;
}

const RATE_LIMITS = {
  proofs_per_hour: { max: 5, window_seconds: 3600 },
  rewards_per_day: { max: 10, window_seconds: 86400 },
  submissions_per_hour: { max: 10, window_seconds: 3600 },
};

export async function checkRateLimit(userId: string, limitType: keyof typeof RATE_LIMITS): Promise<CheckRateLimitResult> {
  const config = RATE_LIMITS[limitType];
  const windowStart = new Date(Date.now() - config.window_seconds * 1000);

  // Check existing rate limit record
  const existing = await queryOne<RateLimit>(
    `SELECT id, user_id, limit_type, count, window_start, window_end
     FROM fraud.rate_limits
     WHERE user_id = $1 AND limit_type = $2 AND window_start >= $3`,
    [userId, limitType, windowStart]
  );

  if (!existing) {
    // No record, allow request
    return {
      allowed: true,
      remaining: config.max - 1,
      reset_at: new Date(Date.now() + config.window_seconds * 1000),
    };
  }

  if (existing.count >= config.max) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      reset_at: existing.window_end,
    };
  }

  return {
    allowed: true,
    remaining: config.max - existing.count - 1,
    reset_at: existing.window_end,
  };
}

export async function incrementRateLimit(userId: string, limitType: keyof typeof RATE_LIMITS): Promise<void> {
  const config = RATE_LIMITS[limitType];
  const now = new Date();
  const windowEnd = new Date(now.getTime() + config.window_seconds * 1000);

  await pool.query(
    `INSERT INTO fraud.rate_limits (user_id, limit_type, count, window_start, window_end)
     VALUES ($1, $2, 1, $3, $4)
     ON CONFLICT (user_id, limit_type) 
     DO UPDATE SET count = fraud.rate_limits.count + 1, 
                   window_start = CASE 
                     WHEN fraud.rate_limits.window_start >= $3 THEN fraud.rate_limits.window_start 
                     ELSE $3 
                   END`,
    [userId, limitType, now, windowEnd]
  );
}

export async function resetRateLimit(userId: string, limitType: string): Promise<void> {
  await pool.query(
    `DELETE FROM fraud.rate_limits WHERE user_id = $1 AND limit_type = $2`,
    [userId, limitType]
  );
}

export async function getCurrentRateLimitCount(userId: string, limitType: string): Promise<number> {
  const config = RATE_LIMITS[limitType as keyof typeof RATE_LIMITS];
  if (!config) return 0;

  const windowStart = new Date(Date.now() - config.window_seconds * 1000);

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT as count FROM fraud.rate_limits 
     WHERE user_id = $1 AND limit_type = $2 AND window_start >= $3`,
    [userId, limitType, windowStart]
  );

  return parseInt(result?.count || '0', 10);
}