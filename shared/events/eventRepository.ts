import { db } from '../database/connection';
import { Event, EventInsert } from './types';

const REQUIRED_FIELDS = [
  'event_id',
  'event_type',
  'version',
  'timestamp',
  'producer',
  'correlation_id',
  'payload',
] as const;

function validateEvent(event: Event): void {
  for (const field of REQUIRED_FIELDS) {
    if (!event[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!event.payload || typeof event.payload !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }
}

export async function saveEvent(event: Event): Promise<void> {
  validateEvent(event);

  try {
    await db.query(
      `INSERT INTO events (
        id,
        event_type,
        version,
        timestamp,
        producer,
        correlation_id,
        payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.event_id,
        event.event_type,
        event.version,
        event.timestamp,
        event.producer,
        event.correlation_id,
        JSON.stringify(event.payload),
      ]
    );
  } catch (error) {
    console.error('[EVENT] Failed to persist event:', error);
    throw new Error(`Failed to save event: ${event.event_id}`);
  }
}

export async function saveEventBatch(events: Event[]): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    for (const event of events) {
      validateEvent(event);
      await client.query(
        `INSERT INTO events (
          id,
          event_type,
          version,
          timestamp,
          producer,
          correlation_id,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          event.event_id,
          event.event_type,
          event.version,
          event.timestamp,
          event.producer,
          event.correlation_id,
          JSON.stringify(event.payload),
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[EVENT] Failed to persist batch:', error);
    throw new Error('Failed to save event batch');
  } finally {
    client.release();
  }
}