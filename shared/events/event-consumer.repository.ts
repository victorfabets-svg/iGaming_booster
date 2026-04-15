import { db } from '../database/connection';
import { Event } from './types';
export { Event };

// ============================================================================
// TASK 1: EVENT LOCK - ensure no duplicate processing
// ============================================================================

export async function ensureProcessedEventsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS events.processed_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * Check if event has already been processed.
 * Uses the event lock pattern to prevent duplicate processing.
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  await ensureProcessedEventsTable();
  
  const result = await db.query<{ event_id: string }>(
    `SELECT event_id FROM events.processed_events WHERE event_id = $1`,
    [eventId]
  );
  
  return result.rows.length > 0;
}

/**
 * Acquire event lock - insert event_id to mark it as being processed.
 * Returns true if lock acquired (event not previously processed).
 * Returns false if event already being processed or was processed.
 */
export async function acquireEventLock(eventId: string): Promise<boolean> {
  await ensureProcessedEventsTable();
  
  try {
    await db.query(
      `INSERT INTO events.processed_events (event_id, processed_at) 
       VALUES ($1, NOW())`,
      [eventId]
    );
    return true;
  } catch (error: any) {
    // If duplicate key error, event was already processed or being processed
    if (error.code === '23505') {
      return false;
    }
    throw error;
  }
}

// Alias for backward compatibility (no-op - ensureProcessedEventsTable is already exported)

// ============================================================================
// TASK 2: DEAD LETTER QUEUE (DLQ)
// ============================================================================

export async function ensureDlqTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS events.dlq_events (
      event_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      error TEXT,
      retries INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * Add failed event to Dead Letter Queue after max retries exhausted.
 */
export async function addToDlq(
  eventId: string,
  payload: Record<string, any>,
  error: string
): Promise<void> {
  await ensureDlqTable();
  
  await db.query(
    `INSERT INTO events.dlq_events (event_id, payload, error, retries)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (event_id) DO UPDATE SET 
       error = $3,
       retries = dlq_events.retries + 1`,
    [eventId, JSON.stringify(payload), error]
  );
}

/**
 * Get retry count for a DLQ event.
 */
export async function getDlqRetryCount(eventId: string): Promise<number> {
  await ensureDlqTable();
  
  const result = await db.query<{ retries: number }>(
    `SELECT retries FROM events.dlq_events WHERE event_id = $1`,
    [eventId]
  );
  
  return result.rows.length > 0 ? result.rows[0].retries : 0;
}

// ============================================================================
// TASK 3: RETRY STRATEGY
// ============================================================================

const MAX_RETRIES = 3;

/**
 * Calculate backoff delay: 1s, 2s, 3s (simple backoff)
 */
export function getBackoffDelay(retryAttempt: number): number {
  return retryAttempt * 1000; // 1s, 2s, 3s
}

/**
 * Process event with retry logic and DLQ fallback.
 * Returns true if successfully processed, false if sent to DLQ.
 */
export async function processEventWithRetry(
  eventId: string,
  payload: Record<string, any>,
  processFn: () => Promise<void>
): Promise<boolean> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[RETRY] Attempt ${attempt}/${MAX_RETRIES} for event ${eventId}`);
      
      await processFn();
      
      // Success - mark as processed
      await markEventProcessed(eventId);
      console.log(`[RETRY] Event ${eventId} processed successfully on attempt ${attempt}`);
      return true;
    } catch (error: any) {
      lastError = error;
      console.error(`[RETRY] Attempt ${attempt} failed for event ${eventId}:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        console.log(`[RETRY] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted - send to DLQ
  console.log(`[DLQ] Max retries (${MAX_RETRIES}) exhausted for event ${eventId}`);
  await addToDlq(eventId, payload, lastError?.message || 'Unknown error');
  return false;
}

// ============================================================================
// EXISTING FUNCTIONS (unchanged)
// ============================================================================

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
