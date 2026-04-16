import { getDb } from '../../../../shared/database/connection';

export interface Ticket {
  id: string;
  user_id: string;
  raffle_id: string;
  number: number;
  reward_id: string;
  created_at: Date;
}

export interface CreateTicketInput {
  user_id: string;
  raffle_id: string;
  number: number;
  reward_id: string;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const result = await getDb().query(
    `INSERT INTO rewards.tickets (user_id, raffle_id, number, reward_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (raffle_id, number) DO NOTHING
     RETURNING id, user_id, raffle_id, number, reward_id, created_at`,
    [input.user_id, input.raffle_id, input.number, input.reward_id]
  );
  return result.rows[0];
}

export async function findTicketByRaffleAndNumber(raffleId: string, number: number): Promise<Ticket | null> {
  const result = await getDb().query(
    `SELECT id, user_id, raffle_id, number, reward_id, created_at
     FROM rewards.tickets
     WHERE raffle_id = $1 AND number = $2`,
    [raffleId, number]
  );
  return result.rows[0] || null;
}

export async function findTicketsByRewardId(rewardId: string): Promise<Ticket[]> {
  const result = await getDb().query(
    `SELECT id, user_id, raffle_id, number, reward_id, created_at
     FROM rewards.tickets
     WHERE reward_id = $1`,
    [rewardId]
  );
  return result.rows;
}

export async function countTicketsByRewardId(rewardId: string): Promise<number> {
  const result = await getDb().query(
    `SELECT COUNT(*) as count FROM rewards.tickets WHERE reward_id = $1`,
    [rewardId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function findTicketsByRaffleId(raffleId: string): Promise<Ticket[]> {
  const result = await getDb().query(
    `SELECT id, user_id, raffle_id, number, reward_id, created_at
     FROM rewards.tickets
     WHERE raffle_id = $1
     ORDER BY number ASC`,
    [raffleId]
  );
  return result.rows;
}