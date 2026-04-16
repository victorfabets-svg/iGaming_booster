import { pool, query } from '../../../lib/database';

export interface PaymentSignal {
  id: string;
  proof_id: string;
  type: string;
  value: string;
  confidence: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreatePaymentSignalInput {
  proof_id: string;
  type: string;
  value: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export async function createPaymentSignal(input: CreatePaymentSignalInput): Promise<PaymentSignal> {
  const result = await pool.query(
    `INSERT INTO payments.payment_signals (proof_id, type, value, confidence, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, proof_id, type, value, confidence, metadata, created_at`,
    [
      input.proof_id,
      input.type,
      input.value,
      input.confidence ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return result.rows[0];
}

/**
 * Create payment signal within a transaction.
 * Uses provided client for atomicity.
 */
export async function createPaymentSignalWithClient(
  client: any,
  input: CreatePaymentSignalInput
): Promise<PaymentSignal> {
  const result = await client.query(
    `INSERT INTO payments.payment_signals (proof_id, type, value, confidence, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, proof_id, type, value, confidence, metadata, created_at`,
    [
      input.proof_id,
      input.type,
      input.value,
      input.confidence ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return result.rows[0];
}

export async function findPaymentSignalsByProofId(proofId: string): Promise<PaymentSignal[]> {
  return await query<PaymentSignal>(
    `SELECT id, proof_id, type, value, confidence, metadata, created_at
     FROM payments.payment_signals
     WHERE proof_id = $1`,
    [proofId]
  );
}

export async function findPaymentSignalByProofAndType(proofId: string, type: string): Promise<PaymentSignal | null> {
  const result = await pool.query(
    `SELECT id, proof_id, type, value, confidence, metadata, created_at
     FROM payments.payment_signals
     WHERE proof_id = $1 AND type = $2`,
    [proofId, type]
  );
  return result.rows[0] || null;
}

export async function countPaymentSignalsByProof(proofId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM payments.payment_signals WHERE proof_id = $1`,
    [proofId]
  );
  return parseInt(result.rows[0].count, 10);
}