import { pool } from 'shared/database/connection';
import { randomUUID } from 'crypto';

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
