/**
 * Event type lock - allowed event types in the system
 * EVENT CHAIN (in causal order):
 * 1. proof_submitted → starts validation
 * 2. fraud_check_requested → triggers fraud scoring
 * 3. fraud_scored → fraud analysis complete
 * 4. payment_identifier_requested → triggers payment extraction
 * 5. payment_identifier_extracted → extraction complete
 * 6. proof_validated → validation approved
 * 7. reward_granted → reward created
 * 8. numbers_generated → tickets generated
 */
export const PIPELINE_EVENTS = [
  'proof_submitted',
  'fraud_check_requested',
  'fraud_scored',
  'payment_identifier_requested',
  'payment_identifier_extracted',
  'proof_validated',
  'reward_granted',
  'numbers_generated',
] as const;

export const DOMAIN_EVENTS = [
  'fraud_flag_detected',
  'proof_rejected',
  'rate_limit_exceeded',
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