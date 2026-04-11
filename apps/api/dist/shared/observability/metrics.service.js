"use strict";
/**
 * Metrics Service
 * Tracks key system metrics for observability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsService = void 0;
exports.recordProofSubmission = recordProofSubmission;
exports.recordValidationResult = recordValidationResult;
exports.recordFraudSignal = recordFraudSignal;
exports.recordReward = recordReward;
exports.recordTicketGenerated = recordTicketGenerated;
exports.recordRaffleExecution = recordRaffleExecution;
exports.getFormattedMetrics = getFormattedMetrics;
class MetricsService {
    constructor() {
        this.metrics = new Map();
        // Initialize default metrics
        this.initializeMetrics();
    }
    static getInstance() {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService();
        }
        return MetricsService.instance;
    }
    initializeMetrics() {
        // Proof metrics
        this.increment('proof_submissions_total', { status: 'attempted' });
        this.increment('proof_submissions_total', { status: 'success' });
        this.increment('proof_submissions_total', { status: 'rate_limited' });
        // Validation metrics
        this.increment('validation_results_total', { status: 'processing' });
        this.increment('validation_results_total', { status: 'approved' });
        this.increment('validation_results_total', { status: 'rejected' });
        this.increment('validation_results_total', { status: 'manual_review' });
        // Fraud metrics
        this.increment('fraud_signals_total', { type: 'behavior' });
        this.increment('fraud_signals_total', { type: 'rate_limit' });
        this.increment('fraud_signals_total', { type: 'high_risk' });
        // Reward metrics
        this.increment('rewards_total', { status: 'granted' });
        this.increment('rewards_total', { status: 'blocked' });
        // Ticket metrics
        this.increment('tickets_generated_total');
        // Raffle metrics
        this.increment('raffle_executions_total', { status: 'executed' });
        this.increment('raffle_executions_total', { status: 'no_tickets' });
    }
    getMetricKey(name, labels) {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(',');
        return `${name}{${labelStr}}`;
    }
    increment(name, labels = {}) {
        const key = this.getMetricKey(name, labels);
        const existing = this.metrics.get(key);
        if (existing) {
            existing.value += 1;
        }
        else {
            this.metrics.set(key, { name, value: 1, labels });
        }
    }
    set(name, value, labels = {}) {
        const key = this.getMetricKey(name, labels);
        this.metrics.set(key, { name, value, labels });
    }
    get(name, labels = {}) {
        const key = this.getMetricKey(name, labels);
        return this.metrics.get(key)?.value ?? 0;
    }
    getAll() {
        return Array.from(this.metrics.values());
    }
    getByName(name) {
        return Array.from(this.metrics.values()).filter(m => m.name === name);
    }
    getFormattedMetrics() {
        const lines = [];
        // Group by metric name
        const grouped = new Map();
        for (const metric of this.metrics.values()) {
            const existing = grouped.get(metric.name) || [];
            existing.push(metric);
            grouped.set(metric.name, existing);
        }
        // Format each metric group
        for (const [name, counters] of grouped) {
            lines.push(`# HELP ${name} ${name.replace(/_/g, ' ')}`);
            lines.push(`# TYPE ${name} counter`);
            for (const counter of counters) {
                const labelStr = Object.entries(counter.labels)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(', ');
                if (labelStr) {
                    lines.push(`${name}{${labelStr}} ${counter.value}`);
                }
                else {
                    lines.push(`${name} ${counter.value}`);
                }
            }
        }
        return lines.join('\n');
    }
    reset() {
        this.metrics.clear();
        this.initializeMetrics();
    }
}
exports.metricsService = MetricsService.getInstance();
// Helper functions for common metrics
function recordProofSubmission(status) {
    exports.metricsService.increment('proof_submissions_total', { status });
}
function recordValidationResult(status) {
    exports.metricsService.increment('validation_results_total', { status });
}
function recordFraudSignal(type) {
    exports.metricsService.increment('fraud_signals_total', { type });
}
function recordReward(status) {
    exports.metricsService.increment('rewards_total', { status });
}
function recordTicketGenerated() {
    exports.metricsService.increment('tickets_generated_total');
}
function recordRaffleExecution(status) {
    exports.metricsService.increment('raffle_executions_total', { status });
}
// Simple getter for formatted metrics - used by controller
function getFormattedMetrics() {
    return exports.metricsService.getFormattedMetrics();
}
//# sourceMappingURL=metrics.service.js.map