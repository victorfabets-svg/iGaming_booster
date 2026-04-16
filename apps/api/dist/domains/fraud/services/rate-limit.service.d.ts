export interface RateLimitConfig {
    proofs_per_hour: number;
    rewards_per_day: number;
    submissions_per_hour: number;
}
export declare class RateLimitService {
    private static instance;
    private constructor();
    static getInstance(): RateLimitService;
    checkProofSubmissionLimit(userId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    checkRewardLimit(userId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    recordProofSubmission(userId: string): Promise<void>;
    recordRewardGranted(userId: string): Promise<void>;
}
export declare const rateLimitService: RateLimitService;
//# sourceMappingURL=rate-limit.service.d.ts.map