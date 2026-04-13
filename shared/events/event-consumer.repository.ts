import { db } from '../database/connection';
import { Event } from './types';
export { Event };

export async function ensureProcessedEventsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS events.processed_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function fetchUnprocessedEvents(limit: number = 100): Promise<Event[]> {
  await ensureProcessedEventsTable();
  
  const result = await db.query<Event>(
    `SELECT e.* 
     FROM events.events e
     LEFT JOIN events.processed_events pe ON e.id = pe.event_id
     WHERE pe.event_id IS NULL
     ORDER BY e.timestamp ASC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows;
}

export async function markEventProcessed(eventId: string): Promise<void> {
  await db.query(
    `INSERT INTO events.processed_events (event_id, processed_at) 
     VALUES ($1, NOW()) 
     ON CONFLICT (event_id) DO UPDATE SET processed_at = NOW()`,
    [eventId]
  );
}
