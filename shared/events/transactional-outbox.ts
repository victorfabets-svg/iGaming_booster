import { randomUUID } from 'crypto';

/**
 * Transactional outbox utilities.
 * 
 * Architecture:
 * - runInTransaction: Core transaction lifecycle (BEGIN/COMMIT/ROLLBACK)
 * - runCommandTransaction: Wrapper for API/use-cases (no idempotency)
 * - processEventExactlyOnce: Wrapper for consumers (with idempotency) - in event-consumer.repository.ts
 * - insertEventInTransaction/insertAuditInTransaction: Helpers for inserting in same transaction
 */

export interface QueuedEvent {
  event_id: string;
  event_type: string;
  version: string;
  payload: Record<string, any>;
  producer: string;
  correlation_id: string;
}

export interface QueuedAudit {
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  metadata: Record<string, any>;
}

// ============================================================================
// CORE: Transaction lifecycle (single source of truth)
// ============================================================================

/**
 * Core transaction lifecycle - manages BEGIN/COMMIT/ROLLBACK.
 * This is the ONLY place where transaction lifecycle is defined.
 */
async function runInTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const { db } = await import('../database/connection');
  const pool = db;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
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

// ============================================================================
// COMMAND WRAPPER: For API/use-cases (no idempotency)
// ============================================================================

/**
 * Wrapper for synchronous command/API operations.
 * Does NOT use processed_events table - user can retry on failure.
 * 
 * Use when: user sends request → server processes → response
 */
export async function runCommandTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  return runInTransaction(callback);
}

/**
 * @deprecated Use runCommandTransaction instead.
 * Kept for backward compatibility.
 */
export async function withTransactionalOutbox<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  return runCommandTransaction(callback);
}

// ============================================================================
// HELPERS: Insert event/audit in same transaction
// ============================================================================

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

/**
 * Legacy queue function - now inserts immediately in transaction.
 */
export async function queueEventInTransaction(
  txnId: any,
  event_type: string,
  payload: Record<string, any>,
  producer: string,
  version = 'v1'
): Promise<void> {
  if (typeof txnId?.query === 'function') {
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
    await insertAuditInTransaction(txnId, action, entity_type, entity_id, user_id, metadata);
  }
}
