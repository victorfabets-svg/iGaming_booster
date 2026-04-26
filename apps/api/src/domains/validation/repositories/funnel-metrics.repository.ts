import { db } from '@shared/database/connection';

export type WindowKey = '1h' | '6h' | '24h' | '7d' | '30d';

const WINDOW_TO_INTERVAL: Record<WindowKey, string> = {
  '1h':  '1 hour',
  '6h':  '6 hours',
  '24h': '24 hours',
  '7d':  '7 days',
  '30d': '30 days',
};

export interface FunnelTotals {
  submitted: number;
  approved: number;
  rejected: number;
  manual_review: number;
  processing: number;
  pending: number;
}

export interface FunnelRow extends FunnelTotals {
  avg_processing_time_ms: number;
}

export async function fetchFunnelTotals(window: WindowKey): Promise<FunnelRow> {
  const interval = WINDOW_TO_INTERVAL[window];
  const result = await db.query<FunnelRow>(
    `WITH window_proofs AS (
       SELECT p.id AS proof_id, p.submitted_at, v.status, v.validated_at
         FROM validation.proofs p
         LEFT JOIN validation.proof_validations v ON v.proof_id = p.id
        WHERE p.submitted_at >= NOW() - $1::interval
     )
     SELECT
       COUNT(*)::int AS submitted,
       COUNT(*) FILTER (WHERE status = 'approved')::int      AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')::int      AS rejected,
       COUNT(*) FILTER (WHERE status = 'manual_review')::int AS manual_review,
       COUNT(*) FILTER (WHERE status = 'processing')::int    AS processing,
       COUNT(*) FILTER (WHERE status = 'pending' OR status IS NULL)::int AS pending,
       COALESCE(
         AVG(EXTRACT(EPOCH FROM (validated_at - submitted_at)) * 1000)
           FILTER (WHERE status IN ('approved','rejected','manual_review') AND validated_at IS NOT NULL),
         0
       )::int AS avg_processing_time_ms
       FROM window_proofs`,
    [interval]
  );
  return result.rows[0];
}