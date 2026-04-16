/**
 * Event type lock - allowed event types in the system
 * Split into pipeline events (user-facing) and domain events (internal)
 */
export const PIPELINE_EVENTS = [
  'proof_submitted',
  'proof_validated',
  'reward_granted',
  'ticket_created',
] as const;

export const DOMAIN_EVENTS = [
  'fraud_flag_detected',
  'proof_rejected',
  'rate_limit_exceeded',
  'payment_identifier_extracted',
  'payment_signal_detected',
] as const;

// All allowed events
export const EVENT_TYPES = [...PIPELINE_EVENTS, ...DOMAIN_EVENTS] as const;

export type EventType = typeof EVENT_TYPES[number];

/**
 * Validate event type before insert
 * Only validates events going through transactional outbox
 * @throws Error if event type is not in the allowed list
 */
export function validateEventType(eventType: string): void {
  if (!EVENT_TYPES.includes(eventType as EventType)) {
    throw new Error(`Invalid event type: "${eventType}". Allowed: ${EVENT_TYPES.join(', ')}`);
  }
}

export interface Event {
  id?: string;
  event_id?: string;
  event_type: string;
  event_version?: string;
  version?: string;
  timestamp?: string;
  producer: string;
  correlation_id?: string;
  payload: Record<string, any>;
}