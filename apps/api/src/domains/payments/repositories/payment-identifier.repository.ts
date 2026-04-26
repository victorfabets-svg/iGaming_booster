import { db, type PoolClient } from '@shared/database/connection';

export interface PaymentIdentifierRow {
  proof_id: string;
  type: string;
  raw_value: string;
  normalized_value: string;
  confidence: number | null;
}

export async function insertPaymentIdentifierWithClient(
  client: PoolClient,
  row: PaymentIdentifierRow
): Promise<void> {
  await client.query(
    `INSERT INTO payments.payment_identifiers
     (proof_id, type, raw_value, normalized_value, confidence)
     VALUES ($1, $2, $3, $4, $5)`,
    [row.proof_id, row.type, row.raw_value, row.normalized_value, row.confidence]
  );
}

/**
 * Count OTHER proofs (proof_id != current) that share the same normalized_value.
 * Use the SAME transactional client so dedup count reflects pre-insert state.
 */
export async function countOtherProofsByNormalizedValue(
  client: PoolClient,
  proofId: string,
  normalizedValue: string
): Promise<number> {
  const r = await client.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c
       FROM payments.payment_identifiers
      WHERE normalized_value = $1
        AND proof_id != $2`,
    [normalizedValue, proofId]
  );
  return r.rows[0]?.c ?? 0;
}