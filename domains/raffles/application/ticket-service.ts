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

export async function createRaffle(input: {
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: Date;
  status: string;
}): Promise<Raffle> {
  const result = await db.query<Raffle>(
    `INSERT INTO raffles.raffles (name, prize, total_numbers, draw_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, prize, total_numbers, draw_date, status`,
    [input.name, input.prize, input.total_numbers, input.draw_date, input.status]
  );
  return result.rows[0];
}

export async function findRaffleById(id: string): Promise<Raffle | null> {
  const result = await db.query<Raffle>(
    `SELECT id, name, prize, total_numbers, draw_date, status
     FROM raffles.raffles
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function getOrCreateActiveRaffle(): Promise<Raffle> {
  const now = new Date();
  let raffle = await getActiveRaffle(now);
  
  if (!raffle) {
    const drawDate = new Date();
    drawDate.setDate(drawDate.getDate() + 30);
    
    raffle = await createRaffle({
      name: 'Default Raffle',
      prize: 'Grand Prize',
      total_numbers: 1000,
      draw_date: drawDate,
      status: 'active',
    });
    console.log(`🎰 Created new raffle: ${raffle.id}`);
  }
  
  return raffle;
}

export interface RaffleTicket {
  id: string;
  user_id: string;
  proof_id: string;
  reward_id: string;
  raffle_id: string;
  number?: number; // for backward compatibility with draw logic
  created_at: Date;
}

export async function findTicketsByRaffleId(raffleId: string): Promise<RaffleTicket[]> {
  const result = await db.query<RaffleTicket>(
    `SELECT id, user_id, proof_id, reward_id, raffle_id, created_at
     FROM raffles.tickets
     WHERE raffle_id = $1`,
    [raffleId]
  );
  return result.rows;
}
