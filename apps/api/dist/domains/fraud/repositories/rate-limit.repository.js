"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
exports.incrementRateLimit = incrementRateLimit;
exports.resetRateLimit = resetRateLimit;
exports.getCurrentRateLimitCount = getCurrentRateLimitCount;
const database_1 = require("../../../lib/database");
const RATE_LIMITS = {
    proofs_per_hour: { max: 5, window_seconds: 3600 },
    rewards_per_day: { max: 10, window_seconds: 86400 },
    submissions_per_hour: { max: 10, window_seconds: 3600 },
};
async function checkRateLimit(userId, limitType) {
    const config = RATE_LIMITS[limitType];
    const windowStart = new Date(Date.now() - config.window_seconds * 1000);
    // Check existing rate limit record
    const existing = await (0, database_1.queryOne)(`SELECT id, user_id, limit_type, count, window_start, window_end
     FROM fraud.rate_limits
     WHERE user_id = $1 AND limit_type = $2 AND window_start >= $3`, [userId, limitType, windowStart]);
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
async function incrementRateLimit(userId, limitType) {
    const config = RATE_LIMITS[limitType];
    const now = new Date();
    const windowEnd = new Date(now.getTime() + config.window_seconds * 1000);
    await database_1.pool.query(`INSERT INTO fraud.rate_limits (user_id, limit_type, count, window_start, window_end)
     VALUES ($1, $2, 1, $3, $4)
     ON CONFLICT (user_id, limit_type) 
     DO UPDATE SET count = fraud.rate_limits.count + 1, 
                   window_start = CASE 
                     WHEN fraud.rate_limits.window_start >= $3 THEN fraud.rate_limits.window_start 
                     ELSE $3 
                   END`, [userId, limitType, now, windowEnd]);
}
async function resetRateLimit(userId, limitType) {
    await database_1.pool.query(`DELETE FROM fraud.rate_limits WHERE user_id = $1 AND limit_type = $2`, [userId, limitType]);
}
async function getCurrentRateLimitCount(userId, limitType) {
    const config = RATE_LIMITS[limitType];
    if (!config)
        return 0;
    const windowStart = new Date(Date.now() - config.window_seconds * 1000);
    const result = await (0, database_1.queryOne)(`SELECT COUNT as count FROM fraud.rate_limits 
     WHERE user_id = $1 AND limit_type = $2 AND window_start >= $3`, [userId, limitType, windowStart]);
    return parseInt(result?.count || '0', 10);
}
//# sourceMappingURL=rate-limit.repository.js.map