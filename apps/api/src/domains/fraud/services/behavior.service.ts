import { findProofById, findProofsByUserId } from '../../validation/repositories/proof.repository';
import { findRiskSignalsByUserId, countRiskSignalsByUser, createRiskSignal } from '../repositories/risk-signal.repository';

export interface BehaviorAnalysisResult {
  is_suspicious: boolean;
  signals: string[];
  risk_score_modifier: number;
}

export class BehaviorAnalysisService {
  private static instance: BehaviorAnalysisService;

  private constructor() {}

  static getInstance(): BehaviorAnalysisService {
    if (!BehaviorAnalysisService.instance) {
      BehaviorAnalysisService.instance = new BehaviorAnalysisService();
    }
    return BehaviorAnalysisService.instance;
  }

  async analyzeBehavior(userId: string, currentProofId?: string): Promise<BehaviorAnalysisResult> {
    const signals: string[] = [];
    let riskScoreModifier = 0;

    // Get user's recent proofs (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userProofs = await this.getUserRecentProofs(userId, oneDayAgo);

    if (userProofs.length === 0) {
      return {
        is_suspicious: false,
        signals: [],
        risk_score_modifier: 0,
      };
    }

    // Signal: Multiple submissions in short period
    if (userProofs.length >= 3) {
      signals.push('multiple_submissions_24h');
      riskScoreModifier += 0.15;
    }

    if (userProofs.length >= 5) {
      signals.push('excessive_submissions_24h');
      riskScoreModifier += 0.25;
    }

    // Signal: Check for repeated file_url (potential duplicate submission)
    const fileUrls = userProofs.map(p => p.file_url);
    const uniqueUrls = new Set(fileUrls);
    if (fileUrls.length > 1 && uniqueUrls.size < fileUrls.length) {
      signals.push('repeated_file_url');
      riskScoreModifier += 0.3;
      await createRiskSignal({
        user_id: userId,
        signal_type: 'repeated_file_url',
        value: fileUrls.join(', '),
        metadata: { proof_ids: userProofs.map(p => p.id), count: fileUrls.length },
      });
    }

    // Signal: Check submission frequency
    if (userProofs.length >= 3) {
      const timestamps = userProofs.map(p => new Date(p.submitted_at).getTime()).sort((a, b) => a - b);
      const avgGap = (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
      const minutesGap = avgGap / (1000 * 60);

      if (minutesGap < 2) {
        signals.push('rapid_submissions');
        riskScoreModifier += 0.2;
      }
    }

    // Signal: Check for risk signals in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRiskSignals = await countRiskSignalsByUser(userId, 'rate_limit_exceeded', oneHourAgo);
    
    if (recentRiskSignals > 0) {
      signals.push('recent_rate_limit_violation');
      riskScoreModifier += 0.1;
    }

    // Signal: Check for fraud flags
    const fraudFlags = await countRiskSignalsByUser(userId, 'fraud_flag_detected');
    if (fraudFlags > 0) {
      signals.push('history_of_fraud_flags');
      riskScoreModifier += 0.2;
    }

    const isSuspicious = signals.length > 0;

    if (isSuspicious) {
      await createRiskSignal({
        user_id: userId,
        signal_type: 'behavior_analysis',
        value: isSuspicious ? 'suspicious' : 'normal',
        metadata: {
          signals,
          riskScoreModifier,
          proof_count_24h: userProofs.length,
        },
      });
    }

    return {
      is_suspicious: isSuspicious,
      signals,
      risk_score_modifier: Math.min(riskScoreModifier, 0.5), // Cap at 0.5
    };
  }

  private async getUserRecentProofs(userId: string, since: Date): Promise<{ id: string; file_url: string; submitted_at: Date }[]> {
    const { query } = await import('../../../lib/database');
    
    const result = await query<{ id: string; file_url: string; submitted_at: Date }>(
      `SELECT id, file_url, submitted_at 
       FROM validation.proofs 
       WHERE user_id = $1 AND submitted_at >= $2
       ORDER BY submitted_at DESC`,
      [userId, since]
    );
    
    return result;
  }

  async flagFraudDetection(userId: string, proofId: string, reason: string): Promise<void> {
    await createRiskSignal({
      user_id: userId,
      signal_type: 'fraud_flag_detected',
      value: reason,
      metadata: { proof_id: proofId },
    });
  }
}

export const behaviorAnalysisService = BehaviorAnalysisService.getInstance();