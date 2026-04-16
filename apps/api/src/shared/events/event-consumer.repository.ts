import { pool, query, execute, queryOne } from '../../lib/database';

export interface Event {
  id: string;
  event_type: string;
  version: string;
  timestamp: Date;
  producer: string;
  correlation_id: string;
  payload: Record<string, unknown>;
}

export interface ProcessedEvent {
  event_id: string;
  consumer_name: string;
  processed_at: Date;
}

const CONSUMER_NAME = 'proof-submitted-consumer';

export async function ensureProcessedEventsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS events.processed_events (
      event_id UUID NOT NULL,
      consumer_name TEXT NOT NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, consumer_name)
    );
  `);
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const result = await queryOne<ProcessedEvent>(
    `SELECT 1 FROM events.processed_events 
     WHERE event_id = $1 AND consumer_name = $2`,
    [eventId, CONSUMER_NAME]
  );
  return !!result;
}

export async function markEventProcessed(eventId: string): Promise<void> {
  await execute(
    `INSERT INTO events.processed_events (event_id, consumer_name, processed_at) 
     VALUES ($1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [eventId, CONSUMER_NAME]
  );
}

export async function fetchUnprocessedEvents(eventType: string, limit: number = 10): Promise<Event[]> {
  // Get events that haven't been processed by this consumer
  const result = await pool.query(
    `SELECT e.id, e.event_type, e.version, e.timestamp, e.producer, e.correlation_id, e.payload
     FROM events.events e
     LEFT JOIN events.processed_events pe 
       ON e.id = pe.event_id AND pe.consumer_name = $1
     WHERE e.event_type = $2 AND pe.event_id IS NULL
     ORDER BY e.timestamp ASC
     LIMIT $3`,
    [CONSUMER_NAME, eventType, limit]
  );
  return result.rows;
}