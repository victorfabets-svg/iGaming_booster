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
declare const RATE_LIMITS: {
    proofs_per_hour: {
        max: number;
        window_seconds: number;
    };
    rewards_per_day: {
        max: number;
        window_seconds: number;
    };
    submissions_per_hour: {
        max: number;
        window_seconds: number;
    };
};
export declare function checkRateLimit(userId: string, limitType: keyof typeof RATE_LIMITS): Promise<CheckRateLimitResult>;
export declare function incrementRateLimit(userId: string, limitType: keyof typeof RATE_LIMITS): Promise<void>;
export declare function resetRateLimit(userId: string, limitType: string): Promise<void>;
export declare function getCurrentRateLimitCount(userId: string, limitType: string): Promise<number>;
export {};
//# sourceMappingURL=rate-limit.repository.d.ts.map