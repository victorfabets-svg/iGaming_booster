import { getDb, PoolClient } from '@shared/database/connection';

export interface Ticket {
  id: string;
  user_id: string;
  proof_id: string;
  reward_id: string;
  raffle_id: string;
  number: number;
  created_at: Date;
}

export interface CreateTicketInput {
  user_id: string;
  proof_id: string;
  reward_id: string;
  raffle_id: string;
  number: number;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const result = await getDb().query(
    `INSERT INTO raffles.tickets (user_id, proof_id, raffle_id, reward_id, number)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (reward_id) DO NOTHING
     RETURNING id, user_id, proof_id, raffle_id, reward_id, number, created_at`,
    [input.user_id, input.proof_id, input.raffle_id, input.reward_id, input.number]
  );
  return result.rows[0];
}

export async function findTicketByRewardId(rewardId: string): Promise<Ticket | null> {
  const result = await getDb().query(
    `SELECT id, user_id, proof_id, raffle_id, reward_id, number, created_at
     FROM raffles.tickets
     WHERE reward_id = $1`,
    [rewardId]
  );
  return result.rows[0] || null;
}

export async function findTicketsByRewardId(rewardId: string): Promise<Ticket[]> {
  const result = await getDb().query(
    `SELECT id, user_id, proof_id, raffle_id, reward_id, number, created_at
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
    `SELECT id, user_id, proof_id, raffle_id, reward_id, number, created_at
     FROM raffles.tickets
     WHERE raffle_id = $1
     ORDER BY number ASC`,
    [raffleId]
  );
  return result.rows;
}

/**
 * Create ticket with deterministic sequence number.
 * Uses transaction: SELECT FOR UPDATE → UPDATE next_number → INSERT ticket
 * @param client - pool client for transaction (if null, creates new connection)
 * @param input - ticket creation input
 * @returns created ticket or null if failed
 */
export async function createTicketWithSequence(
  client: PoolClient | null,
  input: CreateTicketInput
): Promise<Ticket | null> {
  // Use provided client or create new connection
  const ownClient = client || await getClient();
  const shouldRelease = !client;
  
  try {
    if (!client) {
      await ownClient.query('BEGIN');
    }
    
    // Step 1: Get next_number with lock
    const raffleResult = await ownClient.query<{ id: string; next_number: number; total_numbers: number }>(
      `SELECT id, next_number, total_numbers 
       FROM raffles.raffles 
       WHERE id = $1 
       FOR UPDATE`,
      [input.raffle_id]
    );
    
    if (raffleResult.rows.length === 0) {
      throw new Error(`Raffle not found: ${input.raffle_id}`);
    }
    
    const { next_number, total_numbers } = raffleResult.rows[0];
    
    // Step 2: Check if numbers exhausted
    if (next_number > total_numbers) {
      throw new Error(`Raffle numbers exhausted: ${input.raffle_id}`);
    }
    
    // Step 3: Update next_number
    await ownClient.query(
      `UPDATE raffles.raffles 
       SET next_number = next_number + 1 
       WHERE id = $1`,
      [input.raffle_id]
    );
    
    // Step 4: Insert ticket with deterministic number
    const ticketResult = await ownClient.query(
      `INSERT INTO raffles.tickets (user_id, proof_id, raffle_id, reward_id, number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reward_id) DO NOTHING
       RETURNING id, user_id, proof_id, raffle_id, reward_id, number, created_at`,
      [input.user_id, input.proof_id, input.raffle_id, input.reward_id, next_number]
    );
    
    if (!client) {
      await ownClient.query('COMMIT');
    }
    
    return ticketResult.rows[0] || null;
  } catch (err) {
    if (!client) {
      await ownClient.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (shouldRelease) {
      ownClient.release();
    }
  }
}