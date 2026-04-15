import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { db, getClient, saveEventInTransaction } from '../../../shared/database/connection';

export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  start_at: Date;
  end_at: Date;
  status: 'pending' | 'active' | 'closed' | 'completed';
}

/**
 * Get active raffle for ticket creation.
 * FREEZE RULE: Only raffles with status='active' AND now within time window.
 */
export async function getActiveRaffle(now: Date): Promise<Raffle | null> {
  const result = await db.query<Raffle>(
    `SELECT id, name, prize, total_numbers, start_at, end_at, status
     FROM raffles.raffles
     WHERE status = 'active'
       AND $1 >= start_at
       AND $1 <= end_at
     ORDER BY end_at ASC
     LIMIT 1`,
    [now]
  );
  return result.rows[0] || null;
}

/**
 * Get raffle by ID with strict status check.
 */
export async function getRaffleById(raffleId: string): Promise<Raffle | null> {
  const result = await db.query<Raffle>(
    `SELECT id, name, prize, total_numbers, start_at, end_at, status
     FROM raffles.raffles
     WHERE id = $1`,
    [raffleId]
  );
  return result.rows[0] || null;
}

/**
 * Deterministic seed generation: sha256(raffle_id + total_tickets)
 * Ensures seed is based on raffle ID and final ticket count for reproducibility.
 */
function generateSeed(raffleId: string, totalTickets: number): string {
  return crypto.createHash('sha256').update(raffleId + totalTickets).digest('hex');
}

/**
 * Close raffle after end_at passes.
 * Transitions: active -> closed
 * 
 * RACE-SAFE flow:
 * 1. LOCK raffle row (FOR UPDATE)
 * 2. Close raffle (freeze ticket set)
 * 3. COUNT tickets AFTER close
 * 4. Generate & insert seed
 */
export async function closeRaffle(raffleId: string): Promise<boolean> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Step 1: LOCK raffle row to prevent race conditions
    await client.query(
      `SELECT id FROM raffles.raffles WHERE id = $1 FOR UPDATE`,
      [raffleId]
    );
    
    // Step 2: Close raffle FIRST (freezes ticket set)
    const closeResult = await client.query(
      `UPDATE raffles.raffles 
       SET status = 'closed' 
       WHERE id = $1 
         AND status = 'active' 
         AND end_at <= NOW()
       RETURNING id`,
      [raffleId]
    );
    
    if (closeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    
    // Step 3: COUNT after close (race-safe - no new tickets can be added)
    const ticketCountResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM raffles.tickets WHERE raffle_id = $1`,
      [raffleId]
    );
    const totalTickets = parseInt(ticketCountResult.rows[0]?.count ?? '0', 10);
    
    // Step 4: Generate deterministic seed
    const seed = generateSeed(raffleId, totalTickets);
    
    // Step 5: Insert with correct schema (algorithm_version, no result_number)
    await client.query(
      `INSERT INTO raffles.raffle_draws (raffle_id, seed, algorithm_version)
       VALUES ($1, $2, 'v1')
       ON CONFLICT (raffle_id) DO NOTHING`,
      [raffleId, seed]
    );
    
    // Step 6: Emit raffle_closed event (outbox pattern - same transaction)
    await saveEventInTransaction(
      client,
      randomUUID(),
      'raffle_closed',
      'v1',
      'raffles',
      randomUUID(),
      { raffle_id: raffleId, seed, total_tickets: totalTickets }
    );
    
    await client.query('COMMIT');
    console.log(`🔐 Seed persisted for raffle ${raffleId}: ${seed} (${totalTickets} tickets)`);
    console.log(`📤 Emitted raffle_closed event for ${raffleId}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Complete raffle after draw.
 * Transitions: closed -> completed
 */
export async function completeRaffle(raffleId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE raffles.raffles 
     SET status = 'completed' 
     WHERE id = $1 
       AND status = 'closed'
     RETURNING id`,
    [raffleId]
  );
  return result.rows.length > 0;
}