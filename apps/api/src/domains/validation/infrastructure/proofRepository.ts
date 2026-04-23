import { randomUUID } from 'crypto';
import { Proof, ProofInput, ProofResult } from '../domain/proof';

/**
 * Create proof within a transaction - uses provided client for atomicity.
 * This is the ONLY proof creation method - must be called with a valid DB client.
 */
export async function createProofInTransaction(
  client: any,
  proof: ProofInput,
  fileUrl: string,
  hash: string
): Promise<ProofResult> {
  const id = randomUUID();
  const submitted_at = new Date().toISOString();

  // Use ON CONFLICT so a duplicate hash doesn't abort the outer transaction.
  // Throwing on 23505 (as the previous try/catch did) leaves the tx in a
  // poisoned state and every subsequent query fails with 'current transaction
  // is aborted'. DO NOTHING RETURNING lets us detect the conflict cleanly.
  const inserted = await client.query(
    `INSERT INTO validation.proofs (id, user_id, file_url, hash, submitted_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (hash) DO NOTHING
     RETURNING id`,
    [id, proof.user_id, fileUrl, hash, submitted_at]
  );

  if (inserted.rows.length > 0) {
    return {
      proof: {
        id,
        user_id: proof.user_id,
        file_url: fileUrl,
        hash,
        submitted_at,
      },
      isNew: true,
    };
  }

  // Conflict: the same hash already exists. Fetch and return it.
  const existing = await findByHashWithClient(client, hash);
  if (existing) {
    console.log('[PROOF] Duplicate hash detected, returning existing:', existing.id);
    return { proof: existing, isNew: false };
  }

  // Extremely rare: conflict reported but row missing (concurrent delete?).
  // Surface as an error rather than lying about success.
  throw new Error(`Proof insert conflict on hash ${hash} but no matching row found`);
}

/**
 * Find proof by hash using provided client (for use within transaction).
 */
async function findByHashWithClient(client: any, hash: string): Promise<Proof | null> {
  const result = await client.query(
    `SELECT id, user_id, file_url, hash, submitted_at FROM validation.proofs WHERE hash = $1`,
    [hash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Proof;
}