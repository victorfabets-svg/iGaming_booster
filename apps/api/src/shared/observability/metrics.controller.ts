import { metricsService, recordProofSubmission, recordValidationResult, recordFraudSignal, recordReward, recordTicketGenerated, recordRaffleExecution, getFormattedMetrics } from '../observability/metrics.service';

export interface MetricsResponse {
  metrics: string;
  summary: {
    proof_submissions: number;
    validations: {
      approved: number;
      rejected: number;
      manual_review: number;
    };
    rewards: {
      granted: number;
      blocked: number;
    };
    tickets_generated: number;
    raffle_executions: number;
    fraud_signals: number;
  };
}

export async function getMetrics(): Promise<MetricsResponse> {
  const proofSubmissions = metricsService.getAll().filter(m => m.name === 'proof_submissions_total');
  const validationResults = metricsService.getAll().filter(m => m.name === 'validation_results_total');
  const rewards = metricsService.getAll().filter(m => m.name === 'rewards_total');
  const tickets = metricsService.getAll().filter(m => m.name === 'tickets_generated_total');
  const raffles = metricsService.getAll().filter(m => m.name === 'raffle_executions_total');
  const fraudSignals = metricsService.getAll().filter(m => m.name === 'fraud_signals_total');

  // Calculate totals
  const proofSubmissionSuccess = proofSubmissions.find(m => m.labels.status === 'success')?.value || 0;
  const proofSubmissionRateLimited = proofSubmissions.find(m => m.labels.status === 'rate_limited')?.value || 0;

  const validationApproved = validationResults.find(m => m.labels.status === 'approved')?.value || 0;
  const validationRejected = validationResults.find(m => m.labels.status === 'rejected')?.value || 0;
  const validationManual = validationResults.find(m => m.labels.status === 'manual_review')?.value || 0;

  const rewardsGranted = rewards.find(m => m.labels.status === 'granted')?.value || 0;
  const rewardsBlocked = rewards.find(m => m.labels.status === 'blocked')?.value || 0;

  const ticketsGenerated = tickets[0]?.value || 0;
  const raffleExecuted = raffles.find(m => m.labels.status === 'executed')?.value || 0;

  const fraudBehavior = fraudSignals.find(m => m.labels.type === 'behavior')?.value || 0;
  const fraudRateLimit = fraudSignals.find(m => m.labels.type === 'rate_limit')?.value || 0;
  const fraudHighRisk = fraudSignals.find(m => m.labels.type === 'high_risk')?.value || 0;

  return {
    metrics: metricsService.getFormattedMetrics(),
    summary: {
      proof_submissions: proofSubmissionSuccess + proofSubmissionRateLimited,
      validations: {
        approved: validationApproved,
        rejected: validationRejected,
        manual_review: validationManual,
      },
      rewards: {
        granted: rewardsGranted,
        blocked: rewardsBlocked,
      },
      tickets_generated: ticketsGenerated,
      raffle_executions: raffleExecuted,
      fraud_signals: fraudBehavior + fraudRateLimit + fraudHighRisk,
    },
  };
}

// Export metrics recording functions for use in use cases
export {
  recordProofSubmission,
  recordValidationResult,
  recordFraudSignal,
  recordReward,
  recordTicketGenerated,
  recordRaffleExecution,
  metricsService,
};