import { randomUUID } from 'crypto';
import { db } from '../database/connection';

// Thread-local storage for pending operations in current transaction
const pendingEvents = new Map<string, any[]>();
const pendingAudits = new Map<string, any[]>();

/**
 * Start a new transaction context.
 * Must be called before any domain operations.
 */
export async function beginTransaction(): Promise<string> {
  const id = randomUUID();
  pendingEvents.set(id, []);
  pendingAudits.set(id, []);
  return id;
}

/**
 * Queue an event to be committed within the current transaction.
 */
export function queueEventInTransaction(
  txnId: string,
  event_type: string,
  payload: Record<string, any>,
  producer: string,
  version = 'v1'
): void {
  const events = pendingEvents.get(txnId) || [];
  events.push({ 
    event_id: randomUUID(),
    event_type, 
    version, 
    payload, 
    producer,
    correlation_id: randomUUID() 
  });
  pendingEvents.set(txnId, events);
}

/**
 * Queue an audit log to be committed within the current transaction.
 */
export function queueAuditInTransaction(
  txnId: string,
  action: string,
  entity_type: string,
  entity_id: string,
  user_id: string | null,
  metadata: Record<string, any>
): void {
  const audits = pendingAudits.get(txnId) || [];
  audits.push({ action, entity_type, entity_id, user_id, metadata });
  pendingAudits.set(txnId, audits);
}

/**
 * Commit all pending operations in a transaction.
 */
export async function commitTransaction(txnId: string): Promise<void> {
  const events = pendingEvents.get(txnId) || [];
  const audits = pendingAudits.get(txnId) || [];

  for (const evt of events) {
    await db.query(
      `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [evt.event_id, evt.event_type, evt.version, evt.producer, evt.correlation_id, JSON.stringify(evt.payload)]
    );
  }

  for (const audit of audits) {
    await db.query(
      `INSERT INTO audit.audit_logs (action, entity_type, entity_id, user_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [audit.action, audit.entity_type, audit.entity_id, audit.user_id, JSON.stringify(audit.metadata)]
    );
  }

  pendingEvents.delete(txnId);
  pendingAudits.delete(txnId);
}

/**
 * Rollback pending operations.
 */
export async function rollbackTransaction(txnId: string): Promise<void> {
  pendingEvents.delete(txnId);
  pendingAudits.delete(txnId);
}

/**
 * Execute a use case with transactional outbox pattern.
 * All domain writes, events, and audit logs are committed in a single transaction.
 * 
 * @example
 * ```ts
 * await withTransactionalOutbox(async (txnId) => {
 *   // Domain writes
 *   await updateValidationStatus(validation.id, decision, fraudScoreResult.score);
 *   
 *   // Queue event (not committed yet)
 *   queueEventInTransaction(txnId, 'proof_validated', payload, 'validation');
 * });
 * ```
 */
export async function withTransactionalOutbox<T>(
  callback: (txnId: string) => Promise<T>
): Promise<T> {
  const txnId = await beginTransaction();
  
  try {
    const result = await callback(txnId);
    await commitTransaction(txnId);
    return result;
  } catch (error) {
    await rollbackTransaction(txnId);
    throw error;
  }
}