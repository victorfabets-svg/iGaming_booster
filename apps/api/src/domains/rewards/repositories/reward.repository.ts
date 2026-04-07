import { pool, queryOne } from '../../../lib/database';

export interface Reward {
  id: string;
  user_id: string;
  proof_id: string;
  type: string;
  status: string;
  created_at: Date;
}

export interface CreateRewardInput {
  user_id: string;
  proof_id: string;
  type: string;
  status: string;
}

export async function createReward(input: CreateRewardInput): Promise<Reward> {
  const result = await pool.query(
    `INSERT INTO rewards.rewards (user_id, proof_id, type, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, proof_id, type, status, created_at`,
    [input.user_id, input.proof_id, input.type, input.status]
  );
  return result.rows[0];
}

export async function findRewardByProofId(proofId: string): Promise<Reward | null> {
  return await queryOne<Reward>(
    `SELECT id, user_id, proof_id, type, status, created_at
     FROM rewards.rewards
     WHERE proof_id = $1`,
    [proofId]
  );
}

export async function findRewardById(id: string): Promise<Reward | null> {
  return await queryOne<Reward>(
    `SELECT id, user_id, proof_id, type, status, created_at
     FROM rewards.rewards
     WHERE id = $1`,
    [id]
  );
}

export async function updateRewardStatus(id: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE rewards.rewards SET status = $1 WHERE id = $2`,
    [status, id]
  );
}