/**
 * Event type lock - allowed event types in the system
 * All events must be validated against this list before insert
 */
export const EVENT_TYPES = [
  'proof_submitted',
  'proof_validated',
  'reward_granted',
  'ticket_created',
] as const;

export type EventType = typeof EVENT_TYPES[number];

/**
 * Validate event type before insert
 * @throws Error if event type is not in the allowed list
 */
export function validateEventType(eventType: string): void {
  if (!EVENT_TYPES.includes(eventType as EventType)) {
    throw new Error(
      `INVALID EVENT TYPE: "${eventType}". Allowed types: ${EVENT_TYPES.join(', ')}`
    );
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