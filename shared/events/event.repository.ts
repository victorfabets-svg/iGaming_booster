import { pool, db } from 'shared/database/connection';
import { randomUUID } from 'crypto';
import { validateEventType } from './types';

export interface EventInput {
  event_type: string;
  version: string;
  payload: Record<string, unknown>;
  producer: string;
  correlation_id?: string;
}

export interface StoredEvent {
  id: string;
  event_type: string;
  version: string;
  timestamp: Date;
  producer: string;
  correlation_id: string;
  payload: Record<string, unknown>;
}

export async function createEvent(input: EventInput): Promise<StoredEvent> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const correlation_id = input.correlation_id || id;

  const result = await pool.query(
    `INSERT INTO events.events (id, event_type, version, timestamp, producer, correlation_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, event_type, version, timestamp, producer, correlation_id, payload`,
    [id, input.event_type, input.version, timestamp, input.producer, correlation_id, JSON.stringify(input.payload)]
  );
  return result.rows[0];
}

export async function findEventsByType(eventType: string): Promise<StoredEvent[]> {
  const result = await pool.query(
    `SELECT id, event_type, version, timestamp, producer, correlation_id, payload
     FROM events.events
     WHERE event_type = $1
     ORDER BY timestamp DESC`,
    [eventType]
  );
  return result.rows;
}

export async function findAllEvents(limit: number = 50): Promise<StoredEvent[]> {
  const result = await pool.query(
    `SELECT id, event_type, version, timestamp, producer, correlation_id, payload
     FROM events.events
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// Re-export validateEventType for backwards compatibility
export { validateEventType };

// Type alias to avoid DOM Event name conflict (used by saveEvent)
export type AppEvent = {
  id?: string;
  event_id?: string;
  event_type: string;
  event_version?: string;
  version?: string;
  timestamp?: string;
  producer: string;
  correlation_id?: string;
  payload: Record<string, any>;
};

// Backwards compatible saveEvent function (used by emitter.ts)
export async function saveEvent(event: AppEvent): Promise<void> {
  const REQUIRED_FIELDS = ['event_type', 'version', 'producer', 'payload'] as const;

  // Validate strict required fields
  for (const field of REQUIRED_FIELDS) {
    if (!event[field as keyof AppEvent]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate payload is object
  if (!event.payload || typeof event.payload !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }

  // Ensure event_id exists
  const event_id = event.event_id || event.id || randomUUID();

  // Ensure timestamp is ISO string
  const timestamp = event.timestamp || new Date().toISOString();

  // Ensure correlation_id exists
  const correlation_id = event.correlation_id || event_id;

  await db.query(
    `INSERT INTO events.events (
      id,
      event_type,
      version,
      timestamp,
      producer,
      correlation_id,
      payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event_id,
      event.event_type,
      event.version || 'v1',
      timestamp,
      event.producer,
      correlation_id,
      JSON.stringify(event.payload),
    ]
  );
}
