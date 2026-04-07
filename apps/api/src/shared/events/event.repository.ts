import { pool } from '../../lib/database';

export interface EventInput {
  event_type: string;
  version: string;
  payload: Record<string, unknown>;
  producer: string;
}

export interface StoredEvent {
  id: string;
  event_type: string;
  version: string;
  payload: Record<string, unknown>;
  producer: string;
  created_at: Date;
}

export async function createEvent(input: EventInput): Promise<StoredEvent> {
  const result = await pool.query(
    `INSERT INTO events.events (event_type, version, payload, producer)
     VALUES ($1, $2, $3, $4)
     RETURNING id, event_type, version, payload, producer, created_at`,
    [input.event_type, input.version, JSON.stringify(input.payload), input.producer]
  );
  return result.rows[0];
}

export async function findEventsByType(eventType: string): Promise<StoredEvent[]> {
  const result = await pool.query(
    `SELECT id, event_type, version, payload, producer, created_at
     FROM events.events
     WHERE event_type = $1
     ORDER BY created_at DESC`,
    [eventType]
  );
  return result.rows;
}