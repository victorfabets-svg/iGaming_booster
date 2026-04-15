import * as crypto from 'crypto';
import { findRaffleById, updateRaffleStatus } from '../../rewards/repositories/raffle.repository';
import { findTicketsByRaffleId } from '../../rewards/repositories/ticket.repository';
import { createRaffleDraw, findRaffleDrawByRaffleId, updateRaffleDrawWinner } from '../repositories/raffle-draw.repository';
import { withTransactionalOutbox, queueEventInTransaction, insertAuditInTransaction } from '../../../../../../shared/events/transactional-outbox';
import { logger } from '../../../../../../shared/observability/logger';
import { recordRaffleExecution } from '../../../../../../shared/observability/metrics.service';

export interface ExecuteRaffleDrawInput {
  raffle_id: string;
}

export interface ExecuteRaffleDrawResult {
  raffle_id: string;
  winning_number: number;
  user_id: string;
  seed: string;
}

function generateSeed(raffleId: string, timestamp: Date): string {
  // Deterministic seed: hash of raffle_id + timestamp (as ISO string)
  const data = `${raffleId}:${timestamp.toISOString()}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
}

function calculateResultNumber(seed: string, raffleId: string, totalNumbers: number): number {
  // Deterministic algorithm: hash(seed + raffle_id) -> modulo total_numbers + 1
  const data = `${seed}:${raffleId}`;
  const hash = crypto.createHash('sha256').update(data).digest();
  const result = hash.readUInt32BE(0);
  return (result % totalNumbers) + 1;
}

export async function executeRaffleDraw(input: ExecuteRaffleDrawInput): Promise<ExecuteRaffleDrawResult> {
  const { raffle_id } = input;

  console.log(`🎰 Executing raffle draw for raffle: ${raffle_id}`);
  logger.info('raffle_execution_started', 'raffles', `Executing raffle draw: ${raffle_id}`, undefined, { raffle_id });

  // Step 1: Load raffle
  const raffle = await findRaffleById(raffle_id);
  if (!raffle) {
    throw new Error(`Raffle not found: ${raffle_id}`);
  }
  console.log(`📋 Raffle: ${raffle.name}, total_numbers: ${raffle.total_numbers}, status: ${raffle.status}`);

  // Step 2: Check if raffle is active
  if (raffle.status !== 'active') {
    throw new Error(`Raffle is not active: ${raffle.status}`);
  }

  // Step 3: Check if draw already executed (idempotency)
  const existingDraw = await findRaffleDrawByRaffleId(raffle_id);
  if (existingDraw) {
    console.log(`⏭️  Draw already executed for raffle: ${raffle_id}, returning existing result`);
    return {
      raffle_id: raffle_id,
      winning_number: existingDraw.result_number,
      user_id: existingDraw.winner_user_id!,
      seed: existingDraw.seed,
    };
  }

  // Step 4: Generate deterministic seed
  const timestamp = new Date();
  const seed = generateSeed(raffle_id, timestamp);
  console.log(`🔐 Generated seed: ${seed}`);

  // Step 5: Calculate result number
  const resultNumber = calculateResultNumber(seed, raffle_id, raffle.total_numbers);
  console.log(`🎯 Calculated result number: ${resultNumber}`);

  // Step 6: Find winning ticket
  const tickets = await findTicketsByRaffleId(raffle_id);
  console.log(`🎫 Found ${tickets.length} tickets in raffle`);

  // Step 7: Execute draw with full transactional atomicity
  let winnerUserId: string | null = null;
  let winnerTicketNumber: number | null = null;

  const result = await withTransactionalOutbox(async (client) => {
    // Create raffle draw
    const draw = await client.query(
      `INSERT INTO raffles.raffle_draws (raffle_id, seed, algorithm, result_number)
       VALUES ($1, $2, $3, $4)
       RETURNING id, raffle_id, seed, algorithm, result_number, winner_ticket_id, winner_user_id, created_at`,
      [raffle_id, seed, 'sha256_modulo', resultNumber]
    );
    const createdDraw = draw.rows[0];
    console.log(`💾 Persisted raffle draw: ${createdDraw.id}`);

    // Find winner and update
    if (tickets.length > 0) {
      const winningTicket = tickets.find(t => t.number === resultNumber);
      
      let selectedTicket;
      if (!winningTicket) {
        // Map result to valid ticket number using deterministic selection
        const mappedNumber = ((resultNumber - 1) % tickets.length) + 1;
        selectedTicket = tickets[mappedNumber - 1];
        console.log(`🎯 Result number ${resultNumber} not in tickets, mapped to: ${mappedNumber}`);
      } else {
        selectedTicket = winningTicket;
      }

      if (selectedTicket) {
        winnerUserId = selectedTicket.user_id;
        winnerTicketNumber = selectedTicket.number;

        // Update draw with winner
        await client.query(
          `UPDATE raffles.raffle_draws 
           SET winner_ticket_id = $1, winner_user_id = $2 
           WHERE id = $3`,
          [selectedTicket.id, selectedTicket.user_id, createdDraw.id]
        );
        console.log(`🏆 Winner: user_id = ${selectedTicket.user_id}, ticket_number = ${selectedTicket.number}`);
      }
    }

    // Update raffle status
    await client.query(
      `UPDATE raffles.raffles SET status = 'executed' WHERE id = $1`,
      [raffle_id]
    );
    console.log(`✅ Raffle status updated to: executed`);

    // Emit raffle_draw_executed event
    await queueEventInTransaction(client, 'raffle_draw_executed', {
      raffle_id: raffle_id,
      winning_number: winnerTicketNumber || resultNumber,
      user_id: winnerUserId,
      seed: seed,
      ticket_count: tickets.length,
    }, 'raffles');

    // Audit: Insert audit log for raffle executed
    await insertAuditInTransaction(
      client,
      'raffle_executed',
      'raffle',
      raffle_id,
      winnerUserId,
      {
        winners: winnerUserId ? [winnerUserId] : [],
        seed: seed,
        ticket_count: tickets.length,
        winning_number: winnerTicketNumber || resultNumber,
        timestamp: timestamp.toISOString(),
      }
    );

    console.log(`✨ Raffle draw completed for: ${raffle_id}`);

    return {
      raffle_id: raffle_id,
      winning_number: winnerTicketNumber || resultNumber,
      user_id: winnerUserId || '',
      seed: seed,
    };
  });

  // Record metrics
  recordRaffleExecution(tickets.length > 0 ? 'executed' : 'no_tickets');
  logger.info('raffle_execution_completed', 'raffles', `Raffle executed: ${raffle_id}`, undefined, { 
    raffle_id, 
    winning_number: result.winning_number,
    winner_user_id: result.user_id,
    seed: result.seed,
    ticket_count: tickets.length 
  });

  return result;
}