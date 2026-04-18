import { getDb, getClient } from '@shared/database/connection';

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
  number?: number; // Optional - will be assigned deterministically if not provided
}

/**
 * Creates a ticket with deterministic ticket number.
 * Uses SELECT FOR UPDATE to ensure unique, sequential numbers.
 * 
 * Flow:
 * 1. SELECT next_number FROM raffles WHERE id = raffle_id FOR UPDATE
 * 2. FAIL if next_number > total_numbers (no tickets left)
 * 3. INSERT ticket with number = next_number
 * 4. UPDATE raffles SET next_number = next_number + 1
 */
export async function createTicket(input: CreateTicketInput): Promise<Ticket | null> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Step 1: Pre-check - return existing ticket if any (idempotency)
    const existingResult = await client.query(
      `SELECT id, user_id, proof_id, raffle_id, reward_id, number, created_at
       FROM raffles.tickets
       WHERE reward_id = $1`,
      [input.reward_id]
    );
    
    if (existingResult.rows[0]) {
      await client.query('COMMIT');
      return existingResult.rows[0]; // Return existing ticket - idempotency
    }
    
    // Step 2: Get and lock the raffle's next_number
    const raffleResult = await client.query(
      `SELECT next_number, total_numbers 
       FROM raffles.raffles 
       WHERE id = $1 
       FOR UPDATE`,
      [input.raffle_id]
    );
    
    const raffle = raffleResult.rows[0];
    if (!raffle) {
      throw new Error(`Raffle not found: ${input.raffle_id}`);
    }
    
    // Step 3: Check if there are tickets available
    if (raffle.next_number > raffle.total_numbers) {
      throw new Error(`No tickets available in raffle ${input.raffle_id}. Next number: ${raffle.next_number}, Total: ${raffle.total_numbers}`);
    }
    
    // Use the deterministic next_number
    const ticketNumber = raffle.next_number;
    
    // Step 4: Insert ticket with the deterministic number
    // ON CONFLICT handles race condition (another request created ticket)
    const ticketResult = await client.query(
      `INSERT INTO raffles.tickets (user_id, proof_id, raffle_id, reward_id, number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reward_id) DO NOTHING
       RETURNING id, user_id, proof_id, raffle_id, reward_id, number, created_at`,
      [input.user_id, input.proof_id, input.raffle_id, input.reward_id, ticketNumber]
    );
    
    let ticket = ticketResult.rows[0];
    
    // Handle race: if conflict, fetch and return existing ticket
    if (!ticket) {
      const conflictResult = await client.query(
        `SELECT id, user_id, proof_id, raffle_id, reward_id, number, created_at
         FROM raffles.tickets
         WHERE reward_id = $1`,
        [input.reward_id]
      );
      ticket = conflictResult.rows[0];
    } else {
      // Only increment next_number if we actually created a new ticket
      await client.query(
        `UPDATE raffles.raffles 
         SET next_number = next_number + 1 
         WHERE id = $1`,
        [input.raffle_id]
      );
    }
    
    await client.query('COMMIT');
    
    return ticket || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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