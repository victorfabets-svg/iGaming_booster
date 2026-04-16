import { randomUUID } from 'crypto';
import { AppEvent as Event, saveEvent } from './event.repository';

const REQUIRED_FIELDS = ['event_type', 'producer', 'payload'] as const;
const DEFAULT_VERSION = 'v1';

function validateEventInput(event: Partial<Event>): void {
  for (const field of REQUIRED_FIELDS) {
    if (!event[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!event.payload || typeof event.payload !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }
}

function normalizeEventInput(event: Partial<Event>): Event {
  const event_id = event.event_id || randomUUID();
  const timestamp = event.timestamp || new Date().toISOString();
  const version = event.version || DEFAULT_VERSION;
  const correlation_id = event.correlation_id || event_id;
  const event_type = event.event_type!;
  const producer = event.producer!;
  const payload = event.payload!;

  return {
    event_id,
    event_type,
    version,
    timestamp,
    producer,
    correlation_id,
    payload,
  };
}

export async function emitEvent(event: Partial<Event>): Promise<Event> {
  validateEventInput(event);

  const normalizedEvent = normalizeEventInput(event);

  await saveEvent(normalizedEvent);

  console.log(`[EVENT_EMITTED] ${normalizedEvent.event_type}, ${normalizedEvent.event_id}`);

  return normalizedEvent;
}