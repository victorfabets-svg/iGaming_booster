import * as crypto from 'crypto';
import { db } from '../../../../shared/database/connection';

/**
 * Deterministic draw engine - uses seed + SHA256 for reproducible results.
 * Same ticket order + same seed = same winner always.
 */

export interface RaffleDrawResult {
  raffle_id: string;
  seed: string;
  tickets: Array<{ id: string; user_id: string }>;
  winners: Array<{ ticket_id: string; user_id: string }>;
  total_tickets: number;
}

/**
 * Fetch tickets for draw - ordered by id for determinism.
 */
export async function fetchTicketsForDraw(raffleId: string): Promise<Array<{ id: string; user_id: string }>> {
  const result = await db.query<{ id: string; user_id: string }>(
    `SELECT id, user_id
     FROM raffles.tickets
     WHERE raffle_id = $1
     ORDER BY id ASC`,
    [raffleId]
  );
  return result.rows;
}

/**
 * Get seed from raffle_draws table - single source of truth.
 */
export async function getSeedForDraw(raffleId: string): Promise<string | null> {
  const result = await db.query<{ seed: string }>(
    `SELECT seed FROM raffles.raffle_draws WHERE raffle_id = $1`,
    [raffleId]
  );
  return result.rows[0]?.seed ?? null;
}

/**
 * Deterministic winner selection: hash(ticket_id + seed), sort ASC, first wins.
 */
export function selectWinner(
  tickets: Array<{ id: string; user_id: string }>,
  seed: string
): { ticket_id: string; user_id: string } | null {
  if (tickets.length === 0) {
    return null;
  }

  // Hash each ticket with seed, sort, pick first
  const hashed = tickets.map(t => ({
    ticket: t,
    hash: crypto.createHash('sha256').update(t.id + seed).digest('hex')
  }));

  // Sort by hash ASC for deterministic order
  hashed.sort((a, b) => a.hash.localeCompare(b.hash));

  // First sorted ticket wins
  const winner = hashed[0].ticket;
  return { ticket_id: winner.id, user_id: winner.user_id };
}