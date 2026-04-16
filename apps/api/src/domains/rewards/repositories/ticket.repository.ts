import { getDb } from '../../../../shared/database/connection';

export interface Ticket {
  id: string;
  user_id: string;
  proof_id: string;
  reward_id: string;
  raffle_id: string;
  created_at: Date;
}

export interface CreateTicketInput {
  user_id: string;
  proof_id: string;
  reward_id: string;
  raffle_id: string;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const result = await getDb().query(
    `INSERT INTO raffles.tickets (user_id, proof_id, raffle_id, reward_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reward_id) DO NOTHING
     RETURNING id, user_id, proof_id, raffle_id, reward_id, created_at`,
    [input.user_id, input.proof_id, input.raffle_id, input.reward_id]
  );
  return result.rows[0];
}

export async function findTicketByRewardId(rewardId: string): Promise<Ticket | null> {
  const result = await getDb().query(
    `SELECT id, user_id, proof_id, raffle_id, reward_id, created_at
     FROM raffles.tickets
     WHERE reward_id = $1`,
    [rewardId]
  );
  return result.rows[0] || null;
}

export async function findTicketsByRewardId(rewardId: string): Promise<Ticket[]> {
  const result = await getDb().query(
    `SELECT id, user_id, proof_id, raffle_id, reward_id, created_at
     FROM raffles.tickets
     WHERE reward_id = $1`,
    [rewardId]
  );
  return result.rows;
}

export async function countTicketsByRewardId(rewardId: string): Promise<number> {
  const result = await getDb().query(
    `SELECT COUNT(*) as count FROM raffles.tickets WHERE reward_id = $1`,
    [rewardId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function findTicketsByRaffleId(raffleId: string): Promise<Ticket[]> {
  const result = await getDb().query(
    `SELECT id, user_id, proof_id, raffle_id, reward_id, created_at
     FROM raffles.tickets
     WHERE raffle_id = $1
     ORDER BY created_at ASC`,
    [raffleId]
  );
  return result.rows;
}