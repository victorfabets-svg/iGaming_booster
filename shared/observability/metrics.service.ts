/**
 * Metrics Service
 * Tracks key system metrics for observability
 */

export interface MetricCounter {
  name: string;
  value: number;
  labels: Record<string, string>;
}

class MetricsService {
  private static instance: MetricsService;
  private metrics: Map<string, MetricCounter> = new Map();

  private constructor() {
    // Initialize default metrics
    this.initializeMetrics();
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private initializeMetrics(): void {
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

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  increment(name: string, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing) {
      existing.value += 1;
    } else {
      this.metrics.set(key, { name, value: 1, labels });
    }
  }

  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, { name, value, labels });
  }

  get(name: string, labels: Record<string, string> = {}): number {
    const key = this.getMetricKey(name, labels);
    return this.metrics.get(key)?.value ?? 0;
  }

  getAll(): MetricCounter[] {
    return Array.from(this.metrics.values());
  }

  getByName(name: string): MetricCounter[] {
    return Array.from(this.metrics.values()).filter(m => m.name === name);
  }

  getFormattedMetrics(): string {
    const lines: string[] = [];
    
    // Group by metric name
    const grouped = new Map<string, MetricCounter[]>();
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
        } else {
          lines.push(`${name} ${counter.value}`);
        }
      }
    }

    return lines.join('\n');
  }

  reset(): void {
    this.metrics.clear();
    this.initializeMetrics();
  }
}

export const metricsService = MetricsService.getInstance();

// Helper functions for common metrics
export function recordProofSubmission(status: 'success' | 'rate_limited' | 'attempted'): void {
  metricsService.increment('proof_submissions_total', { status });
}

export function recordValidationResult(status: 'approved' | 'rejected' | 'manual_review' | 'processing'): void {
  metricsService.increment('validation_results_total', { status });
}

export function recordFraudSignal(type: 'behavior' | 'rate_limit' | 'high_risk'): void {
  metricsService.increment('fraud_signals_total', { type });
}

export function recordReward(status: 'granted' | 'blocked'): void {
  metricsService.increment('rewards_total', { status });
}

export function recordTicketGenerated(): void {
  metricsService.increment('tickets_generated_total');
}

export function recordRaffleExecution(status: 'executed' | 'no_tickets'): void {
  metricsService.increment('raffle_executions_total', { status });
}

// Simple getter for formatted metrics - used by controller
export function getFormattedMetrics(): string {
  return metricsService.getFormattedMetrics();
}