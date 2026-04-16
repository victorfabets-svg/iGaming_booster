import { pool, query, queryOne, execute } from 'shared/database/connection';
import { randomUUID } from 'crypto';

export interface Proof {
  id: string;
  user_id: string;
  file_url: string;
  hash: string;
  submitted_at: Date;
}

export interface CreateProofInput {
  user_id: string;
  file_url: string;
  hash: string;
}

export async function createProof(input: CreateProofInput): Promise<Proof> {
  const result = await pool.query(
    `INSERT INTO validation.proofs (user_id, file_url, hash)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, file_url, hash, submitted_at`,
    [input.user_id, input.file_url, input.hash]
  );
  return result.rows[0];
}

/**
 * Create proof within a transaction.
 * Uses provided client for atomicity.
 */
export async function createProofInTransaction(
  client: any,
  input: CreateProofInput
): Promise<Proof> {
  const result = await client.query(
    `INSERT INTO validation.proofs (user_id, file_url, hash)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, file_url, hash, submitted_at`,
    [input.user_id, input.file_url, input.hash]
  );
  return result.rows[0];
}

export async function findProofByHash(hash: string): Promise<Proof | null> {
  return await queryOne<Proof>(
    `SELECT id, user_id, file_url, hash, submitted_at 
     FROM validation.proofs 
     WHERE hash = $1`,
    [hash]
  );
}

export async function findProofById(id: string): Promise<Proof | null> {
  return await queryOne<Proof>(
    `SELECT id, user_id, file_url, hash, submitted_at 
     FROM validation.proofs 
     WHERE id = $1`,
    [id]
  );
}

export async function findProofsByUserId(userId: string): Promise<Proof[]> {
  return await query<Proof>(
    `SELECT id, user_id, file_url, hash, submitted_at 
     FROM validation.proofs 
     WHERE user_id = $1 
     ORDER BY submitted_at DESC`,
    [userId]
  );
}