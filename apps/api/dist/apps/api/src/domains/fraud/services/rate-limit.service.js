"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitService = exports.RateLimitService = void 0;
const rate_limit_repository_1 = require("../repositories/rate-limit.repository");
const risk_signal_repository_1 = require("../repositories/risk-signal.repository");
class RateLimitService {
    constructor() { }
    static getInstance() {
        if (!RateLimitService.instance) {
            RateLimitService.instance = new RateLimitService();
        }
        return RateLimitService.instance;
    }
    async checkProofSubmissionLimit(userId) {
        const result = await (0, rate_limit_repository_1.checkRateLimit)(userId, 'proofs_per_hour');
        if (!result.allowed) {
            await (0, risk_signal_repository_1.createRiskSignal)({
                user_id: userId,
                signal_type: 'rate_limit_exceeded',
                value: 'proofs_per_hour',
                metadata: {
                    limit: 5,
                    window_seconds: 3600,
                    reset_at: result.reset_at,
                },
            });
            return {
                allowed: false,
                reason: `Rate limit exceeded. Next submission allowed at ${result.reset_at.toISOString()}`,
            };
        }
        return { allowed: true };
    }
    async checkRewardLimit(userId) {
        const result = await (0, rate_limit_repository_1.checkRateLimit)(userId, 'rewards_per_day');
        if (!result.allowed) {
            await (0, risk_signal_repository_1.createRiskSignal)({
                user_id: userId,
                signal_type: 'rate_limit_exceeded',
                value: 'rewards_per_day',
                metadata: {
                    limit: 10,
                    window_seconds: 86400,
                    reset_at: result.reset_at,
                },
            });
            return {
                allowed: false,
                reason: `Daily reward limit exceeded. Try again tomorrow.`,
            };
        }
        return { allowed: true };
    }
    async recordProofSubmission(userId) {
        await (0, rate_limit_repository_1.incrementRateLimit)(userId, 'proofs_per_hour');
    }
    async recordRewardGranted(userId) {
        await (0, rate_limit_repository_1.incrementRateLimit)(userId, 'rewards_per_day');
    }
}
exports.RateLimitService = RateLimitService;
exports.rateLimitService = RateLimitService.getInstance();
//# sourceMappingURL=rate-limit.service.js.map