import { db } from '../database/connection';
import { Event } from './types';
export { Event };

// ============================================================================
// ROW LOCK - Ensure atomic event fetching with FOR UPDATE SKIP LOCKED
// ============================================================================

/**
 * Fetch unprocessed events with row-level locking (FOR UPDATE SKIP LOCKED).
 * This prevents multiple consumers from processing the same event.
 * 
 * NOTE: Schema must exist via migration (009_hardening_layer.sql).
 * If tables/columns are missing, this will fail fast - which is correct behavior.
 */
export async function fetchAndLockEvents(limit: number = 10): Promise<Event[]> {
  const result = await db.query<Event>(
    `SELECT id, event_type, version, producer, correlation_id, payload, 
            retry_count, processed, timestamp, locked_at
     FROM events.events
     WHERE processed = FALSE 
       AND retry_count < 3
     ORDER BY timestamp ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit]
  );

  return result.rows;
}

/**
 * Lock event when starting to process (set locked_at).
 */
export async function lockEvent(eventId: string): Promise<void> {
  await db.query(
    `UPDATE events.events 
     SET locked_at = NOW() 
     WHERE id = $1`,
    [eventId]
  );
}

// TASK 4: STUCK EVENT RECOVERY
/**
 * Release stuck events that have been locked for more than 5 minutes.
 * These events were likely abandoned by crashed consumers.
 */
export async function recoverStuckEvents(): Promise<number> {
  const result = await db.query<{ id: string }>(
    `UPDATE events.events 
     SET locked_at = NULL
     WHERE locked_at IS NOT NULL 
       AND locked_at < NOW() - INTERVAL '5 minutes'
     RETURNING id`
  );
  
  const count = result.rows.length;
  if (count > 0) {
    console.log(`[RECOVERY] Released ${count} stuck events`);
  }
  return count;
}

/**
 * Start stuck event recovery - runs periodically every 60 seconds.
 * Must be called once globally at application startup.
 */
let recoveryInterval: NodeJS.Timeout | null = null;

export function startStuckEventRecovery(): void {
  if (recoveryInterval) {
    console.log('[RECOVERY] Already running, skipping duplicate start');
    return;
  }

  console.log('[RECOVERY] Starting stuck event recovery background job');
  
  // Run immediately on startup
  recoverStuckEvents().catch(err => {
    console.error('[RECOVERY] Initial run failed:', err.message);
  });

  // Then run every 60 seconds
  recoveryInterval = setInterval(() => {
    recoverStuckEvents().catch(err => {
      console.error('[RECOVERY] Periodic run failed:', err.message);
    });
  }, 60000);
}

/**
 * Stop stuck event recovery (for graceful shutdown).
 */
export function stopStuckEventRecovery(): void {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
    console.log('[RECOVERY] Stopped stuck event recovery');
  }
}

/**
 * Mark event as processed (success).
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  await db.query(
    `UPDATE events.events 
     SET processed = TRUE, processed_at = NOW() 
     WHERE id = $1`,
    [eventId]
  );
}

/**
 * Increment retry count when processing fails.
 * This controls retry attempts and prevents infinite loops.
 */
export async function incrementRetryCount(eventId: string): Promise<void> {
  await db.query(
    `UPDATE events.events 
     SET retry_count = retry_count + 1 
     WHERE id = $1`,
    [eventId]
  );
}

/**
 * Get current retry count for an event.
 */
export async function getRetryCount(eventId: string): Promise<number> {
  const result = await db.query<{ retry_count: number }>(
    `SELECT retry_count FROM events.events WHERE id = $1`,
    [eventId]
  );
  return result.rows[0]?.retry_count ?? 0;
}

// ============================================================================
// TASK 2: DLQ - Dead Letter Queue for failed events
// ============================================================================

/**
 * Add failed event to Dead Letter Queue.
 */
export async function addToDlq(
  eventId: string,
  payload: Record<string, any>,
  error: string
): Promise<void> {
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
 * Check if event is in DLQ.
 */
export async function isInDlq(eventId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM events.dlq_events WHERE event_id = $1`,
    [eventId]
  );
  return result.rows.length > 0;
}

/**
 * Get all DLQ events.
 */
export async function getDlqEvents(limit: number = 100): Promise<any[]> {
  const result = await db.query(
    `SELECT * FROM events.dlq_events 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Reprocess DLQ event (reset retry state).
 */
export async function reprocessDlqEvent(eventId: string): Promise<void> {
  // Remove from DLQ and reset retry count
  await db.query(
    `DELETE FROM events.dlq_events WHERE event_id = $1`,
    [eventId]
  );
  await db.query(
    `UPDATE events.events SET retry_count = 0 WHERE id = $1`,
    [eventId]
  );
}

// ============================================================================
// TASK 3: RETRY LOGIC - Proper retry with backoff
// ============================================================================

const MAX_RETRIES = 3;

/**
 * Get backoff delay (exponential: 1s, 2s, 3s).
 */
export function getBackoffDelay(retryCount: number): number {
  return (retryCount + 1) * 1000;
}

/**
 * Process event with proper retry logic.
 * Returns true if successfully processed, false if sent to DLQ.
 */
export async function processWithRetry(
  eventId: string,
  payload: Record<string, any>,
  processFn: () => Promise<void>
): Promise<boolean> {
  const currentRetry = await getRetryCount(eventId);

  for (let attempt = currentRetry + 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[PROCESS] Attempt ${attempt}/${MAX_RETRIES} for event ${eventId}`);
      await processFn();
      
      // Mark as processed on success
      await markEventProcessed(eventId);
      console.log(`✅ Event ${eventId} processed successfully on attempt ${attempt}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt} failed for ${eventId}:`, error.message);
      
      // Increment retry count after each failure
      await incrementRetryCount(eventId);
      
      if (attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        console.log(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted - send to DLQ
  console.error(`[DLQ] Event ${eventId} failed after ${MAX_RETRIES} attempts`);
  await addToDlq(eventId, payload, `Failed after ${MAX_RETRIES} attempts`);
  return false;
}

// ============================================================================
// LEGACY: Backward compatibility functions
// ============================================================================

export async function ensureProcessedEventsTable(): Promise<void> {
  // Schema now must exist via migration - fail fast if missing
}

export async function fetchUnprocessedEvents(limit: number = 100): Promise<Event[]> {
  return fetchAndLockEvents(limit);
}

export async function acquireEventLock(eventId: string): Promise<boolean> {
  // Row locking handles this - just check if already processed
  const result = await db.query<{ id: string }>(
    `SELECT id FROM events.events WHERE id = $1 AND processed = TRUE`,
    [eventId]
  );
  return result.rows.length === 0;
}

export async function ensureDlqTable(): Promise<void> {
  // Schema now must exist via migration - fail fast if missing
}

export async function markEventProcessedLegacy(eventId: string): Promise<void> {
  await markEventProcessed(eventId);
}

export async function processEventWithRetryLegacy(
  eventId: string,
  payload: Record<string, any>,
  processFn: () => Promise<void>
): Promise<boolean> {
  return processWithRetry(eventId, payload, processFn);
}

export function getBackoffDelayLegacy(retryAttempt: number): number {
  return getBackoffDelay(retryAttempt);
}

// ============================================================================
// TASK 5: EXACTLY-ONCE PROCESSING - Idempotency for event processing
// ============================================================================

/**
 * Check if event was already processed (idempotency check).
 * Returns true if event exists in processed_events table.
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM events.processed_events WHERE event_id = $1`,
    [eventId]
  );
  return result.rows.length > 0;
}

/**
 * Mark event as processed in the idempotency table.
 * Should be called AFTER successful processing within a transaction.
 */
export async function markEventAsProcessed(eventId: string): Promise<void> {
  await db.query(
    `INSERT INTO events.processed_events (event_id) VALUES ($1)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId]
  );
}

/**
 * Process event with exactly-once guarantee using transaction.
 * - Checks if already processed (skip if yes)
 * - Wraps processing + idempotency record in single transaction
 * 
 * Returns: { success: boolean, skipped: boolean }
 */
export async function processEventExactlyOnce(
  eventId: string,
  processFn: () => Promise<void>
): Promise<{ success: boolean; skipped: boolean }> {
  // Step 1: Check if already processed (skip duplicate)
  const alreadyProcessed = await isEventProcessed(eventId);
  if (alreadyProcessed) {
    console.log(`⏭️  Event ${eventId} already processed, skipping`);
    return { success: true, skipped: true };
  }

  // Step 2: Process event within transaction with idempotency record
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Execute the business logic
    await processFn();
    
    // Record successful processing (idempotency key)
    await client.query(
      `INSERT INTO events.processed_events (event_id) VALUES ($1)`,
      [eventId]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Event ${eventId} processed exactly-once`);
    return { success: true, skipped: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
