import { pool, queryOne } from '../../../lib/database';

export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: Date;
  status: string;
}

export async function findRaffleById(id: string): Promise<Raffle | null> {
  return await queryOne<Raffle>(
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE id = $1`,
    [id]
  );
}

export async function findActiveRaffle(): Promise<Raffle | null> {
  return await queryOne<Raffle>(
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE status = 'active'
     AND draw_date > NOW()
     ORDER BY draw_date ASC
     LIMIT 1`
  );
}

export async function createRaffle(input: {
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: Date;
  status: string;
}): Promise<Raffle> {
  const result = await pool.query(
    `INSERT INTO raffles.raffles (name, prize, total_numbers, draw_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, prize, total_numbers, draw_date, status`,
    [input.name, input.prize, input.total_numbers, input.draw_date, input.status]
  );
  return result.rows[0];
}

export async function updateRaffleStatus(id: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE raffles.raffles SET status = $1 WHERE id = $2`,
    [status, id]
  );
}

export async function findAllRaffles(): Promise<Raffle[]> {
  const result = await pool.query(
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     ORDER BY draw_date DESC`
  );
  return result.rows;
}