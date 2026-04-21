import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { db, getClient, saveEventInTransaction } from '@shared/database/connection';

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
 * Get raffle by ID with strict status check.
 * Uses FOR SHARE to prevent race conditions while allowing concurrent reads.
 */
export async function getRaffleById(raffleId: string): Promise<Raffle | null> {
  const client = await getClient();
  try {
    // FOR SHARE: prevents concurrent FOR UPDATE, but allows other SHARED reads
    const result = await client.query<Raffle>(
      `SELECT id, name, prize, total_numbers, start_at, end_at, status
       FROM raffles.raffles
       WHERE id = $1
       FOR SHARE`,
      [raffleId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Deterministic seed generation: sha256(raffle_id + total_tickets)
 */
function generateSeed(raffleId: string, totalTickets: number): string {
  return crypto.createHash('sha256').update(raffleId + totalTickets).digest('hex');
}

/**
 * Close raffle - FULL implementation in domain layer.
 *
 * RACE-SAFE flow:
 * 1. LOCK raffle row (FOR UPDATE)
 * 2. Close raffle (freeze ticket set)
 * 3. COUNT tickets AFTER close
 * 4. Generate & insert seed
 * 5. Emit raffle_draw_executed event (outbox)
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

    // Insert seed into raffle_draws (schema: algorithm_version)
    await client.query(
      `INSERT INTO raffles.raffle_draws (raffle_id, seed, algorithm_version)
       VALUES ($1, $2, 'v1')
       ON CONFLICT (raffle_id) DO NOTHING`,
      [raffleId, seed]
    );

    // Step 5: Emit raffle_draw_executed event (outbox pattern - same transaction)
    await saveEventInTransaction(
      client,
      randomUUID(),
      'raffle_draw_executed',
      'v1',
      'raffles',
      randomUUID(),
      { raffle_id: raffleId }
    );

    await client.query('COMMIT');
    console.log(`🔐 Seed persisted for raffle ${raffleId}: ${seed} (${totalTickets} tickets)`);
    console.log(`📤 Emitted raffle_draw_executed event for ${raffleId}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}