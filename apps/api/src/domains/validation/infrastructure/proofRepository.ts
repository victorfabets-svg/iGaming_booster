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

  try {
    await client.query(
      `INSERT INTO validation.proofs (id, user_id, file_url, hash, submitted_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, proof.user_id, fileUrl, hash, submitted_at]
    );

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
  } catch (error: any) {
    // Handle UNIQUE constraint violation - return existing proof (within same transaction)
    if (error.code === '23505' && error.constraint === 'validation_proofs_hash_key') {
      const existing = await findByHashWithClient(client, hash);
      if (existing) {
        console.log('[PROOF] Duplicate detected at DB level, returning existing:', existing.id);
        return { proof: existing, isNew: false };
      }
    }
    throw error;
  }
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