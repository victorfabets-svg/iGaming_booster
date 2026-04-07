import { randomUUID } from 'crypto';
import { db } from '../../../../shared/database/connection';
import { Proof, ProofInput } from '../domain/proof';

export async function createProof(proof: ProofInput, fileUrl: string, hash: string): Promise<Proof> {
  const id = randomUUID();
  const created_at = new Date().toISOString();

  await db.query(
    `INSERT INTO proofs (id, user_id, file_url, hash, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, proof.user_id, fileUrl, hash, created_at]
  );

  return {
    id,
    user_id: proof.user_id,
    file_url: fileUrl,
    hash,
    created_at,
  };
}

export async function findByHash(hash: string): Promise<Proof | null> {
  const result = await db.query(
    `SELECT id, user_id, file_url, hash, created_at FROM proofs WHERE hash = $1`,
    [hash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as Proof;
}