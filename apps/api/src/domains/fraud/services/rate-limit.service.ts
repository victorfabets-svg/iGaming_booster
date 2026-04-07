import { checkRateLimit, incrementRateLimit } from '../repositories/rate-limit.repository';
import { createRiskSignal } from '../repositories/risk-signal.repository';

export interface RateLimitConfig {
  proofs_per_hour: number;
  rewards_per_day: number;
  submissions_per_hour: number;
}

export class RateLimitService {
  private static instance: RateLimitService;

  private constructor() {}

  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  async checkProofSubmissionLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const result = await checkRateLimit(userId, 'proofs_per_hour');
    
    if (!result.allowed) {
      await createRiskSignal({
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

  async checkRewardLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const result = await checkRateLimit(userId, 'rewards_per_day');
    
    if (!result.allowed) {
      await createRiskSignal({
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

  async recordProofSubmission(userId: string): Promise<void> {
    await incrementRateLimit(userId, 'proofs_per_hour');
  }

  async recordRewardGranted(userId: string): Promise<void> {
    await incrementRateLimit(userId, 'rewards_per_day');
  }
}

export const rateLimitService = RateLimitService.getInstance();