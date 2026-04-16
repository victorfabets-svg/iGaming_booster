import { pool, queryOne } from '../../../../shared/database/connection';

export interface RaffleDraw {
  id: string;
  raffle_id: string;
  seed: string;
  algorithm: string;
  result_number: number;
  winner_user_id: string | null;
  winner_ticket_id: string | null;
  executed_at: Date;
}

export interface CreateRaffleDrawInput {
  raffle_id: string;
  seed: string;
  algorithm: string;
  result_number: number;
}

export async function createRaffleDraw(input: CreateRaffleDrawInput): Promise<RaffleDraw> {
  const result = await pool.query(
    `INSERT INTO raffles.raffle_draws (raffle_id, seed, algorithm, result_number)
     VALUES ($1, $2, $3, $4)
     RETURNING id, raffle_id, seed, algorithm, result_number, winner_user_id, winner_ticket_id, executed_at`,
    [input.raffle_id, input.seed, input.algorithm, input.result_number]
  );
  return result.rows[0];
}

export async function findRaffleDrawByRaffleId(raffleId: string): Promise<RaffleDraw | null> {
  return await queryOne<RaffleDraw>(
    `SELECT id, raffle_id, seed, algorithm, result_number, winner_user_id, winner_ticket_id, executed_at
     FROM raffles.raffle_draws
     WHERE raffle_id = $1`,
    [raffleId]
  );
}

export async function updateRaffleDrawWinner(
  drawId: string,
  winnerUserId: string,
  winnerTicketId: string
): Promise<void> {
  await pool.query(
    `UPDATE raffles.raffle_draws 
     SET winner_user_id = $1, winner_ticket_id = $2
     WHERE id = $3`,
    [winnerUserId, winnerTicketId, drawId]
  );
}

export async function markRaffleExecuted(raffleId: string): Promise<void> {
  await pool.query(
    `UPDATE raffles.raffles 
     SET status = 'executed'
     WHERE id = $1`,
    [raffleId]
  );
}