/**
 * Metrics Service
 * Tracks key system metrics for observability
 */
export interface MetricCounter {
    name: string;
    value: number;
    labels: Record<string, string>;
}
declare class MetricsService {
    private static instance;
    private metrics;
    private constructor();
    static getInstance(): MetricsService;
    private initializeMetrics;
    private getMetricKey;
    increment(name: string, labels?: Record<string, string>): void;
    set(name: string, value: number, labels?: Record<string, string>): void;
    get(name: string, labels?: Record<string, string>): number;
    getAll(): MetricCounter[];
    getByName(name: string): MetricCounter[];
    getFormattedMetrics(): string;
    reset(): void;
}
export declare const metricsService: MetricsService;
export declare function recordProofSubmission(status: 'success' | 'rate_limited' | 'attempted'): void;
export declare function recordValidationResult(status: 'approved' | 'rejected' | 'manual_review' | 'processing'): void;
export declare function recordFraudSignal(type: 'behavior' | 'rate_limit' | 'high_risk'): void;
export declare function recordReward(status: 'granted' | 'blocked'): void;
export declare function recordTicketGenerated(): void;
export declare function recordRaffleExecution(status: 'executed' | 'no_tickets'): void;
export declare function getFormattedMetrics(): string;
export {};
//# sourceMappingURL=metrics.service.d.ts.map