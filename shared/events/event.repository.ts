// =================================================================
// Legacy event repository - for backward compatibility
// All new event creation should go through transactional outbox
// Use: insertEventInTransaction from './transactional-outbox'
// =================================================================

import { Event, EventType } from './types';
import { db } from '../database/connection';

export { Event } from './types';

export interface AppEvent extends Event {
  created_at?: string;
  processed?: boolean;
  processed_at?: string;
  locked_at?: string;
  retry_count?: number;
}

// DEPRECATED - throws error if called
export async function createEvent(...args: any[]) {
  throw new Error('DEPRECATED: Use transactional-outbox. Import from ./transactional-outbox instead');
}

export async function saveEvent(...args: any[]) {
  throw new Error('DEPRECATED: Use transactional-outbox. Import from ./transactional-outbox instead');
}

// Legacy function for backward compatibility
export async function findAllEvents(limit: number = 50): Promise<AppEvent[]> {
  const result = await db.query<AppEvent>(
    `SELECT * FROM events.events ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
