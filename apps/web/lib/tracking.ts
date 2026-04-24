export type TrackEvent =
  | 'proof_submitted'
  | 'upload_failed';

export function track(event: TrackEvent, payload: Record<string, unknown> = {}): void {
  console.info('[track]', event, { ...payload, ts: Date.now() });
}

export default track;
