export type TrackEvent =
  | 'proof_submitted'
  | 'proof_approved'
  | 'proof_rejected'
  | 'proof_manual_review'
  | 'proof_poll_timeout'
  | 'upload_failed';

export function track(event: TrackEvent, payload: Record<string, unknown> = {}): void {
  console.info('[track]', event, { ...payload, ts: Date.now() });
}

export default track;
