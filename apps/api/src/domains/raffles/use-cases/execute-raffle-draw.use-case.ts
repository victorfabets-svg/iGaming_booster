import { getSeedForDraw, fetchTicketsForDraw, selectWinner } from '../../../domains/raffles/application/draw-engine';
import { getRaffleById } from '../../../domains/raffles/application/get-active-raffle';
import { db } from '../../../../../../shared/database/connection';
import { randomUUID } from 'crypto';
import { logger } from '../../../../../../shared/observability/logger';
import { recordRaffleExecution } from '../../../../../../shared/observability/metrics.service';

export interface ExecuteRaffleDrawInput {
  raffle_id: string;
}

export interface ExecuteRaffleDrawResult {
  raffle_id: string;
  winning_ticket_id: string | null;
  user_id: string | null;
  seed: string;
  total_tickets: number;
}

export async function executeRaffleDraw(input: ExecuteRaffleDrawInput): Promise<ExecuteRaffleDrawResult> {
  const { raffle_id } = input;

  console.log(`🎰 Executing raffle draw for raffle: ${raffle_id}`);
  logger.info('raffle_execution_started', 'raffles', `Executing raffle draw: ${raffle_id}`, undefined, { raffle_id });

  // Step 1: Check if draw already has winner (IDEMPOTENCY GUARD)
  const existingDraw = await db.query<{ raffle_id: string; winner_ticket_id: string; winner_user_id: string; seed: string }>(
    `SELECT raffle_id, winner_ticket_id, winner_user_id, seed 
     FROM raffles.raffle_draws 
     WHERE raffle_id = $1`,
    [raffle_id]
  );

  // If winner already exists, return early (idempotent)
  if (existingDraw.rows[0]?.winner_ticket_id) {
    const existing = existingDraw.rows[0];
    console.log(`♻️  Draw already executed for raffle: ${raffle_id}, returning existing winner`);
    logger.info('raffle_already_executed', 'raffles', `Draw already executed: ${raffle_id}`, undefined, { raffle_id });
    return {
      raffle_id: existing.raffle_id,
      winning_ticket_id: existing.winner_ticket_id,
      user_id: existing.winner_user_id,
      seed: existing.seed,
      total_tickets: 0, // Not known from this query, but idempotent result
    };
  }

  // Step 2: Get seed from raffle_draws - FAILSAFE
  let seed = existingDraw.rows[0]?.seed ?? await getSeedForDraw(raffle_id);
  if (!seed) {
    console.log(`⚠️  No seed found for raffle: ${raffle_id}, cannot execute draw`);
    throw new Error(`Seed not found for raffle: ${raffle_id}. Draw requires seed.`);
  }
  console.log(`🔐 Using seed: ${seed}`);

  // Step 3: Validate raffle is closed
  const raffle = await getRaffleById(raffle_id);
  if (!raffle) {
    throw new Error(`Raffle not found: ${raffle_id}`);
  }
  if (raffle.status !== 'closed') {
    throw new Error(`Raffle must be closed to execute draw: ${raffle.status}`);
  }
  console.log(`📋 Raffle: ${raffle.name}, status: ${raffle.status}`);

  // Step 4: Fetch tickets - FAILSAFE
  const tickets = await fetchTicketsForDraw(raffle_id);
  console.log(`🎫 Found ${tickets.length} tickets in raffle`);

  // Step 5: Exit if no tickets
  if (tickets.length === 0) {
    console.log(`⚠️  No tickets in raffle, exiting draw`);
    
    // Still update status to completed
    await db.query(
      `UPDATE raffles.raffles SET status = 'completed' WHERE id = $1 AND status = 'closed'`,
      [raffle_id]
    );
    
    return {
      raffle_id,
      winning_ticket_id: null,
      user_id: null,
      seed,
      total_tickets: 0,
    };
  }

  // Step 6: Run deterministic draw + state update + event in SINGLE TRANSACTION
  const winners = selectWinner(tickets, seed);
  const winnerTicketId = winners?.ticket_id ?? null;
  const winnerUserId = winners?.user_id ?? null;

  await db.query('BEGIN');

  try {
    // Persist winner if exists
    if (winnerTicketId && winnerUserId) {
      await db.query(
        `UPDATE raffles.raffle_draws 
         SET winner_ticket_id = $1, winner_user_id = $2 
         WHERE raffle_id = $3`,
        [winnerTicketId, winnerUserId, raffle_id]
      );
      console.log(`🏆 Winner: ticket_id = ${winnerTicketId}, user_id = ${winnerUserId}`);
    }

    // Update raffle status to completed (inside transaction)
    await db.query(
      `UPDATE raffles.raffles SET status = 'completed' WHERE id = $1 AND status = 'closed'`,
      [raffle_id]
    );

    // Emit raffle_completed event (inside transaction)
    await db.query(
      `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload, created_at)
       VALUES ($1, 'raffle_completed', 'v1', 'raffles', $2, $3, NOW())`,
      [
        randomUUID(),
        randomUUID(),
        JSON.stringify({
          raffle_id,
          winners: winnerTicketId ? [{ ticket_id: winnerTicketId, user_id: winnerUserId }] : [],
          total_tickets: tickets.length,
          seed,
        })
      ]
    );
    console.log(`📤 Emitted raffle_completed event`);

    await db.query('COMMIT');
    console.log(`✨ Raffle draw completed for: ${raffle_id}`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }

  // Record metrics
  recordRaffleExecution(tickets.length > 0 ? 'executed' : 'no_tickets');
  logger.info('raffle_execution_completed', 'raffles', `Raffle executed: ${raffle_id}`, undefined, { 
    raffle_id, 
    winner_ticket_id: winnerTicketId,
    winner_user_id: winnerUserId,
    seed,
    ticket_count: tickets.length 
  });

  return {
    raffle_id,
    winning_ticket_id: winnerTicketId,
    user_id: winnerUserId,
    seed,
    total_tickets: tickets.length,
  };
}