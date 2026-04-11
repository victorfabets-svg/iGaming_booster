import { metricsService, recordProofSubmission, recordValidationResult, recordFraudSignal, recordReward, recordTicketGenerated, recordRaffleExecution } from '../observability/metrics.service';
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
export declare function getMetrics(): Promise<MetricsResponse>;
export { recordProofSubmission, recordValidationResult, recordFraudSignal, recordReward, recordTicketGenerated, recordRaffleExecution, metricsService, };
//# sourceMappingURL=metrics.controller.d.ts.map