import { randomUUID } from 'crypto';

/**
 * Transactional outbox utilities.
 * Only insertEventInTransaction and insertAuditInTransaction should be used directly in consumers.
 * Transaction management is handled by the caller (e.g., processEventExactlyOnce).
 * 
 * For consumers: use processEventExactlyOnce as the only transaction boundary.
 * For non-consumer code paths (API routes): withTransactionalOutbox is still available.
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

/**
 * Execute callback within a database transaction.
 * Uses single DB client - all writes are atomic.
 * NOTE: For consumer code paths, prefer processEventExactlyOnce instead.
 */
export async function withTransactionalOutbox<T>(
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
