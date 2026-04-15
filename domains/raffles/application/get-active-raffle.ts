import { db } from '../../../shared/database/connection';

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
 * Close raffle after end_at passes.
 * Transitions: active -> closed
 */
export async function closeRaffle(raffleId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE raffles.raffles 
     SET status = 'closed' 
     WHERE id = $1 
       AND status = 'active' 
       AND end_at <= NOW()
     RETURNING id`,
    [raffleId]
  );
  return result.rows.length > 0;
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