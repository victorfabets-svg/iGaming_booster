"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsService = exports.recordRaffleExecution = exports.recordTicketGenerated = exports.recordReward = exports.recordFraudSignal = exports.recordValidationResult = exports.recordProofSubmission = void 0;
exports.getMetrics = getMetrics;
const metrics_service_1 = require("../observability/metrics.service");
Object.defineProperty(exports, "metricsService", { enumerable: true, get: function () { return metrics_service_1.metricsService; } });
Object.defineProperty(exports, "recordProofSubmission", { enumerable: true, get: function () { return metrics_service_1.recordProofSubmission; } });
Object.defineProperty(exports, "recordValidationResult", { enumerable: true, get: function () { return metrics_service_1.recordValidationResult; } });
Object.defineProperty(exports, "recordFraudSignal", { enumerable: true, get: function () { return metrics_service_1.recordFraudSignal; } });
Object.defineProperty(exports, "recordReward", { enumerable: true, get: function () { return metrics_service_1.recordReward; } });
Object.defineProperty(exports, "recordTicketGenerated", { enumerable: true, get: function () { return metrics_service_1.recordTicketGenerated; } });
Object.defineProperty(exports, "recordRaffleExecution", { enumerable: true, get: function () { return metrics_service_1.recordRaffleExecution; } });
async function getMetrics() {
    const proofSubmissions = metrics_service_1.metricsService.getAll().filter(m => m.name === 'proof_submissions_total');
    const validationResults = metrics_service_1.metricsService.getAll().filter(m => m.name === 'validation_results_total');
    const rewards = metrics_service_1.metricsService.getAll().filter(m => m.name === 'rewards_total');
    const tickets = metrics_service_1.metricsService.getAll().filter(m => m.name === 'tickets_generated_total');
    const raffles = metrics_service_1.metricsService.getAll().filter(m => m.name === 'raffle_executions_total');
    const fraudSignals = metrics_service_1.metricsService.getAll().filter(m => m.name === 'fraud_signals_total');
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
        metrics: metrics_service_1.metricsService.getFormattedMetrics(),
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
//# sourceMappingURL=metrics.controller.js.map