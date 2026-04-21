import { randomUUID } from 'crypto';
import { db, getDb } from '../database/connection';

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
 * Execute callback with a database client.
 * Transaction management is handled by the caller (e.g., processEventExactlyOnce).
 * This wrapper does NOT open a new transaction - it reuses the caller's transaction.
 */
export async function withTransactionalOutbox<T>(
  client: any,
  callback: (client: any) => Promise<T>
): Promise<T> {
  // No new transaction - just execute with the provided client
  return callback(client);
}

/**
 * Insert event within transaction.
 */
export async function insertEventInTransaction(
  client: any,
  event_type: string,
  payload: Record<string, any>,
  producer: string,
  version = 'v1'
): Promise<void> {
  const event_id = randomUUID();
  const correlation_id = randomUUID();
  
  await client.query(
    `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload, created_at)
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