import { randomUUID } from 'crypto';
import { pool } from '../../../lib/database';
import { Proof, ProofInput, ProofResult } from '../domain/proof';

export async function createProof(proof: ProofInput, fileUrl: string, hash: string): Promise<ProofResult> {
  const id = randomUUID();
  const submitted_at = new Date().toISOString();

  try {
    await pool.query(
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
    // Handle UNIQUE constraint violation - return existing proof
    if (error.code === '23505' && error.constraint === 'proofs_hash_key') {
      const existing = await findByHash(hash);
      if (existing) {
        console.log('[PROOF] Duplicate detected at DB level, returning existing:', existing.id);
        return { proof: existing, isNew: false };
      }
    }
    throw error;
  }
}

export async function findByHash(hash: string): Promise<Proof | null> {
  const result = await pool.query(
    `SELECT id, user_id, file_url, hash, submitted_at FROM validation.proofs WHERE hash = $1`,
    [hash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Proof;
}