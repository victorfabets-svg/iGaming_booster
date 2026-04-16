import { pool, queryOne } from 'shared/database/connection';
import { PoolClient } from 'pg';

// Simple invariant check - fail-fast on invalid input
function validateRewardPayload(input: CreateRewardInput): void {
  if (!input || !input.user_id || !input.proof_id) {
    throw new Error('Invalid reward payload: user_id and proof_id are required');
  }
}

export interface Reward {
  id: string;
  user_id: string;
  proof_id: string;
  reward_type: string;
  value: number;
  status: string;
  created_at: Date;
}

export interface CreateRewardInput {
  user_id: string;
  proof_id: string;
  reward_type: string;
  value: number;
  status?: string;
}

// Default reward value for approved proof
const DEFAULT_REWARD_VALUE = 10;
const DEFAULT_REWARD_TYPE = 'approval';
const DEFAULT_REWARD_STATUS = 'granted';

/**
 * Create a reward - status is ALWAYS forced to 'granted'
 * This guarantees runtime integrity regardless of input
 */
export async function createReward(input: CreateRewardInput): Promise<Reward> {
  // Fail-fast on invalid input
  validateRewardPayload(input);
  
  // Force status to 'granted' - never allow override
  const forcedStatus = DEFAULT_REWARD_STATUS;
  
  const result = await pool.query(
    `INSERT INTO rewards.rewards (user_id, proof_id, reward_type, value, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (proof_id) DO UPDATE SET reward_type = EXCLUDED.reward_type
     RETURNING id, user_id, proof_id, reward_type, value, created_at`,
    [input.user_id, input.proof_id, input.reward_type || DEFAULT_REWARD_TYPE, input.value || DEFAULT_REWARD_VALUE, forcedStatus]
  );
  return result.rows[0];
}

// Transaction-aware version for use within withTransaction
export async function createRewardTx(
  input: CreateRewardInput,
  client: PoolClient
): Promise<Reward> {
  // Fail-fast on invalid input
  validateRewardPayload(input);
  
  // Force status to 'granted' - never allow override
  const forcedStatus = DEFAULT_REWARD_STATUS;
  
  const result = await client.query(
    `INSERT INTO rewards.rewards (user_id, proof_id, reward_type, value, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (proof_id) DO UPDATE SET reward_type = EXCLUDED.reward_type
     RETURNING id, user_id, proof_id, reward_type, value, created_at`,
    [input.user_id, input.proof_id, input.reward_type || DEFAULT_REWARD_TYPE, input.value || DEFAULT_REWARD_VALUE, forcedStatus]
  );
  return result.rows[0];
}

export async function findRewardByProofId(proofId: string): Promise<Reward | null> {
  return await queryOne<Reward>(
    `SELECT id, user_id, proof_id, reward_type, value, status, created_at
     FROM rewards.rewards
     WHERE proof_id = $1`,
    [proofId]
  );
}

export async function findRewardById(id: string): Promise<Reward | null> {
  return await queryOne<Reward>(
    `SELECT id, user_id, proof_id, reward_type, value, status, created_at
     FROM rewards.rewards
     WHERE id = $1`,
    [id]
  );
}

export async function updateRewardStatus(id: string, status: string): Promise<void> {
  // Deprecated - status field no longer exists
  console.log(`[WARNING] updateRewardStatus is deprecated, status field removed`);
}

// Add findAllRewards for backward compatibility with routes
export async function findAllRewards(): Promise<Reward[]> {
  const result = await pool.query(
    `SELECT id, user_id, proof_id, reward_type as type, value, status, created_at
     FROM rewards.rewards
     ORDER BY created_at DESC`
  );
  return result.rows;
}