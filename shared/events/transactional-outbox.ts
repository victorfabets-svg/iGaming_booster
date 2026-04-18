import { randomUUID } from 'crypto';
import { db, getDb } from '../database/connection';
import { validateEventType, EVENT_TYPES } from './types';

/**
 * REAL transactional outbox using single DB client.
 * All domain writes, events, and audit logs are committed in a single DB transaction.
 */

// ============================================================================
// TASK 1: REAL TRANSACTION with single client
// ============================================================================

interface QueuedEvent {
  event_id: string;
  event_type: string;
  version: string;
  payload: Record<string, any>;
  producer: string;
  correlation_id: string;
}

interface QueuedAudit {
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  metadata: Record<string, any>;
}

/**
 * Execute callback within a REAL database transaction.
 * Uses single DB client - all writes are atomic.
 */
export async function withTransactionalOutbox<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getDb();
  const client = await pool.connect();
  
  try {
    // TASK 2: ENFORCE TIMEOUT - Set statement timeout before BEGIN
    await client.query('SET statement_timeout = 5000');
    await client.query('BEGIN');
    
    // Execute callback with the client (for domain writes + event/audit in same tx)
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insert event within transaction.
 * Validates event type against allowed EVENT_TYPES before insert
 */
export async function insertEventInTransaction(
  client: any,
  event_type: string,
  payload: Record<string, any>,
  producer: string,
  version = 'v1'
): Promise<void> {
  // Validate event type before insert
  validateEventType(event_type);
  
  const event_id = randomUUID();
  const correlation_id = randomUUID();
  
  await client.query(
    `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [event_id, event_type, version, producer, correlation_id, JSON.stringify(payload)]
  );
}

/**
 * Insert audit log within transaction.
 */
export async function insertAuditInTransaction(
  client: any,
  action: string,
  entity_type: string,
  entity_id: string,
  user_id: string | null,
  metadata: Record<string, any>
): Promise<void> {
  await client.query(
    `INSERT INTO audit.audit_logs (id, action, entity_type, entity_id, user_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [randomUUID(), action, entity_type, entity_id, user_id, JSON.stringify(metadata)]
  );
}

// ============================================================================
// BACKWARD COMPATIBILITY - wrap old API
// ============================================================================

/**
 * Legacy queue function - now inserts immediately in transaction.
 * Kept for backward compatibility.
 */
export async function queueEventInTransaction(
  txnId: any,
  event_type: string,
  payload: Record<string, any>,
  producer: string,
  version = 'v1'
): Promise<void> {
  if (typeof txnId?.query === 'function') {
    // Validate event type before insert
    validateEventType(event_type);
    // It's a client - insert directly
    await insertEventInTransaction(txnId, event_type, payload, producer, version);
  }
}

/**
 * Legacy queue function - now inserts immediately in transaction.
 */
export async function queueAuditInTransaction(
  txnId: any,
  action: string,
  entity_type: string,
  entity_id: string,
  user_id: string | null,
  metadata: Record<string, any>
): Promise<void> {
  if (typeof txnId?.query === 'function') {
    // It's a client - insert directly
    await insertAuditInTransaction(txnId, action, entity_type, entity_id, user_id, metadata);
  }
}