import { fetchFunnelTotals, WindowKey } from '../../validation/repositories/funnel-metrics.repository';
import { getDlqSize } from '@shared/events/event-consumer.repository';
import { db } from '@shared/database/connection';

const ALERT_WINDOW: WindowKey = '1h';

const THRESHOLDS = {
  min_approval_rate: 0.3,
  max_avg_processing_time_ms: 30_000,
  max_stalled_event_age_minutes: 5,
  max_dlq_size: 10,
} as const;

const VOLUME_GUARDS = {
  min_submitted_for_approval_alert: 10,
} as const;

export type AlertSeverity = 'warning' | 'critical';
export type AlertId = 'low_approval_rate' | 'slow_processing' | 'consumer_stalled' | 'dlq_growing';

export interface Alert {
  id: AlertId;
  severity: AlertSeverity;
  triggered: boolean;
  threshold: number;
  current_value: number;
  reason: string;
  details?: Record<string, unknown>;
}

export interface AlertReport {
  evaluated_at: string;
  window: string;
  alerts: Alert[];
  summary: {
    triggered_count: number;
    critical_count: number;
    warning_count: number;
    healthy: boolean;
  };
}

/**
 * Count events that have been unprocessed for longer than threshold minutes.
 */
async function fetchStalledEventCount(thresholdMinutes: number): Promise<number> {
  const r = await db.query<{ stuck: number }>(
    `SELECT COUNT(*)::int AS stuck
       FROM events.events
      WHERE processed = FALSE
        AND created_at < NOW() - ($1 || ' minutes')::interval`,
    [thresholdMinutes.toString()]
  );
  return r.rows[0]?.stuck ?? 0;
}

/**
 * Evaluate all alerts against live DB state.
 * Reuses fetchFunnelTotals and getDlqSize — no new tables.
 */
export async function evaluateAlerts(): Promise<AlertReport> {
  // 1) Funnel totals (reuses T5 query)
  const funnel = await fetchFunnelTotals(ALERT_WINDOW);
  const terminal = funnel.approved + funnel.rejected + funnel.manual_review;
  const approvalRate = terminal === 0 ? 0 : funnel.approved / terminal;

  // 2) Queue health
  const stalledCount = await fetchStalledEventCount(THRESHOLDS.max_stalled_event_age_minutes);
  const dlqCount = await getDlqSize();

  const alerts: Alert[] = [
    // low_approval_rate (volume-guarded)
    (() => {
      const enoughVolume = funnel.submitted >= VOLUME_GUARDS.min_submitted_for_approval_alert;
      const triggered = enoughVolume && approvalRate < THRESHOLDS.min_approval_rate;
      return {
        id: 'low_approval_rate',
        severity: 'warning' as AlertSeverity,
        triggered,
        threshold: THRESHOLDS.min_approval_rate,
        current_value: Math.round(approvalRate * 10000) / 10000,
        reason: enoughVolume
          ? (triggered
            ? `approval_rate ${approvalRate.toFixed(2)} < ${THRESHOLDS.min_approval_rate}`
            : `approval_rate ${approvalRate.toFixed(2)} OK`)
          : 'volume_too_low',
        details: { window: ALERT_WINDOW, submitted: funnel.submitted, terminal, approved: funnel.approved },
      };
    })(),

    // slow_processing
    (() => {
      const hasTerminal = terminal > 0;
      const triggered = hasTerminal && funnel.avg_processing_time_ms > THRESHOLDS.max_avg_processing_time_ms;
      return {
        id: 'slow_processing',
        severity: 'warning' as AlertSeverity,
        triggered,
        threshold: THRESHOLDS.max_avg_processing_time_ms,
        current_value: funnel.avg_processing_time_ms,
        reason: hasTerminal
          ? (triggered
            ? `avg ${funnel.avg_processing_time_ms}ms > ${THRESHOLDS.max_avg_processing_time_ms}ms`
            : `avg ${funnel.avg_processing_time_ms}ms OK`)
          : 'no_terminal_decisions_in_window',
        details: { window: ALERT_WINDOW, terminal },
      };
    })(),

    // consumer_stalled
    {
      id: 'consumer_stalled',
      severity: 'critical' as AlertSeverity,
      triggered: stalledCount > 0,
      threshold: 0,
      current_value: stalledCount,
      reason: stalledCount > 0
        ? `${stalledCount} unprocessed events older than ${THRESHOLDS.max_stalled_event_age_minutes}min`
        : 'no_stalled_events',
      details: { age_minutes: THRESHOLDS.max_stalled_event_age_minutes },
    },

    // dlq_growing
    {
      id: 'dlq_growing',
      severity: 'warning' as AlertSeverity,
      triggered: dlqCount > THRESHOLDS.max_dlq_size,
      threshold: THRESHOLDS.max_dlq_size,
      current_value: dlqCount,
      reason: dlqCount > THRESHOLDS.max_dlq_size
        ? `dlq ${dlqCount} > ${THRESHOLDS.max_dlq_size}`
        : `dlq ${dlqCount} OK`,
    },
  ];

  const triggered = alerts.filter(a => a.triggered);
  return {
    evaluated_at: new Date().toISOString(),
    window: ALERT_WINDOW,
    alerts,
    summary: {
      triggered_count: triggered.length,
      critical_count: triggered.filter(a => a.severity === 'critical').length,
      warning_count: triggered.filter(a => a.severity === 'warning').length,
      healthy: triggered.length === 0,
    },
  };
}