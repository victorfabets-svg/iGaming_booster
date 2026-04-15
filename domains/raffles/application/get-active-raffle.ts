import { db } from '../../../shared/database/connection';

export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: Date;
  status: 'pending' | 'active' | 'closed' | 'completed';
}

/**
 * Get active raffle for ticket creation.
 * FREEZE RULE: Only raffles with status='active' AND draw_date in future accept tickets.
 */
export async function getActiveRaffle(now: Date): Promise<Raffle | null> {
  const result = await db.query<Raffle>(
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE status = 'active'
       AND draw_date > $1
     ORDER BY draw_date ASC
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
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE id = $1`,
    [raffleId]
  );
  return result.rows[0] || null;
}

/**
 * Close raffle after draw date passes.
 * Transitions: active -> closed
 */
export async function closeRaffle(raffleId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE raffles.raffles 
     SET status = 'closed' 
     WHERE id = $1 
       AND status = 'active' 
       AND draw_date <= NOW()
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