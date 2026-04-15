import { db } from '../../../shared/database/connection';

export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: Date;
  status: string;
}

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