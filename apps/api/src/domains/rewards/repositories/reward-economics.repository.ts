import { getDb, db } from '@shared/database/connection';

export interface RewardEconomics {
  id: string;
  reward_id: string;
  cost: number;
  estimated_revenue: number;
  margin: number;
  created_at: Date;
}

export interface CreateRewardEconomicsInput {
  reward_id: string;
  cost: number;
  estimated_revenue: number;
}

export async function createRewardEconomics(input: CreateRewardEconomicsInput): Promise<RewardEconomics> {
  const margin = input.estimated_revenue - input.cost;
  
  const result = await getDb().query(
    `INSERT INTO rewards.reward_economics (reward_id, cost, estimated_revenue, margin)
     VALUES ($1, $2, $3, $4)
     RETURNING id, reward_id, cost, estimated_revenue, margin, created_at`,
    [input.reward_id, input.cost, input.estimated_revenue, margin]
  );
  return result.rows[0];
}

export async function findRewardEconomicsByRewardId(rewardId: string): Promise<RewardEconomics | null> {
  return await db.query<RewardEconomics>(
    `SELECT id, reward_id, cost, estimated_revenue, margin, created_at
     FROM rewards.reward_economics
     WHERE reward_id = $1`,
    [rewardId]
  ).then(r => r.rows[0] || null);
}

export async function getTotalEconomics(): Promise<{
  total_cost: number;
  total_revenue: number;
  total_margin: number;
  reward_count: number;
}> {
  const result = await getDb().query(
    `SELECT 
       COALESCE(SUM(cost), 0) as total_cost,
       COALESCE(SUM(estimated_revenue), 0) as total_revenue,
       COALESCE(SUM(margin), 0) as total_margin,
       COUNT(*) as reward_count
     FROM rewards.reward_economics`
  );
  
  return {
    total_cost: parseFloat(result.rows[0].total_cost),
    total_revenue: parseFloat(result.rows[0].total_revenue),
    total_margin: parseFloat(result.rows[0].total_margin),
    reward_count: parseInt(result.rows[0].reward_count, 10),
  };
}