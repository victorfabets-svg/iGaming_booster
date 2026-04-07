import { randomUUID } from 'crypto';
import { db } from '../database/connection';
import { Event } from './types';

const REQUIRED_FIELDS = ['event_type', 'version', 'producer', 'payload'] as const;

function validateEvent(event: Event): void {
  // Validate strict required fields
  for (const field of REQUIRED_FIELDS) {
    if (!event[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate payload is object
  if (!event.payload || typeof event.payload !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }
}

function normalizeEvent(event: Event): Event {
  // Ensure event_id exists
  const event_id = event.event_id || randomUUID();

  // Ensure timestamp is ISO string
  const timestamp = event.timestamp || new Date().toISOString();

  // Ensure correlation_id exists
  const correlation_id = event.correlation_id || event_id;

  return {
    ...event,
    event_id,
    timestamp,
    correlation_id,
  };
}

export async function saveEvent(event: Event): Promise<void> {
  const normalized = normalizeEvent(event);
  validateEvent(normalized);

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
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        normalized.event_id,
        normalized.event_type,
        normalized.version,
        normalized.timestamp,
        normalized.producer,
        normalized.correlation_id,
        JSON.stringify(normalized.payload),
      ]
    );
  } catch (error) {
    console.error('[EVENT_SAVE_ERROR]', normalized, error);
    throw new Error(`Failed to save event: ${normalized.event_id}`);
  }
}