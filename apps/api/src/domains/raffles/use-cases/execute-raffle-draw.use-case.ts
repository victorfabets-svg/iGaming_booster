import * as crypto from 'crypto';
import { findRaffleById, updateRaffleStatus } from '../../rewards/repositories/raffle.repository';
import { findTicketsByRaffleId } from '../../rewards/repositories/ticket.repository';
import { createRaffleDraw, findRaffleDrawByRaffleId, updateRaffleDrawWinner } from '../repositories/raffle-draw.repository';
import { createEvent } from '../../../shared/events/event.repository';
import { logger } from '../../../shared/observability/logger';
import { recordRaffleExecution } from '../../../shared/observability/metrics.service';
import { isRaffleEnabled } from '../../../shared/config/feature-flags';

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

  // Check if raffle is enabled
  if (!isRaffleEnabled()) {
    logger.warn('raffle_disabled', 'raffles', 'Raffle execution is currently disabled', undefined, { raffle_id });
    throw new Error('Raffle execution is currently disabled');
  }

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

  // Step 6: Persist draw result
  const draw = await createRaffleDraw({
    raffle_id: raffle_id,
    seed: seed,
    algorithm: 'sha256_modulo',
    result_number: resultNumber,
  });
  console.log(`💾 Persisted raffle draw: ${draw.id}`);

  // Step 7: Find winning ticket
  const tickets = await findTicketsByRaffleId(raffle_id);
  console.log(`🎫 Found ${tickets.length} tickets in raffle`);

  if (tickets.length === 0) {
    console.log(`⚠️  No tickets in raffle, draw completed without winner`);
    // Update raffle status anyway
    await updateRaffleStatus(raffle_id, 'executed');
    
    // Emit raffle_draw_executed event
    await createEvent({
      event_type: 'raffle_draw_executed',
      version: 'v1',
      payload: {
        raffle_id: raffle_id,
        winning_number: resultNumber,
        user_id: null,
        seed: seed,
        ticket_count: 0,
      },
      producer: 'raffles',
    });

    return {
      raffle_id: raffle_id,
      winning_number: resultNumber,
      user_id: '',
      seed: seed,
    };
  }

  const winningTicket = tickets.find(t => t.number === resultNumber);

  if (!winningTicket) {
    // Map result to valid ticket number using deterministic selection
    const mappedNumber = ((resultNumber - 1) % tickets.length) + 1;
    const selectedTicket = tickets[mappedNumber - 1];
    
    console.log(`🎯 Result number ${resultNumber} not in tickets, mapped to: ${mappedNumber}`);
    
    // Update draw with winner
    await updateRaffleDrawWinner(draw.id, selectedTicket.user_id, selectedTicket.id);
    console.log(`🏆 Winner: user_id = ${selectedTicket.user_id}, ticket_number = ${selectedTicket.number}`);

    // Update raffle status
    await updateRaffleStatus(raffle_id, 'executed');

    // Emit raffle_draw_executed event
    await createEvent({
      event_type: 'raffle_draw_executed',
      version: 'v1',
      payload: {
        raffle_id: raffle_id,
        winning_number: selectedTicket.number,
        user_id: selectedTicket.user_id,
        seed: seed,
        ticket_count: tickets.length,
      },
      producer: 'raffles',
    });

    return {
      raffle_id: raffle_id,
      winning_number: selectedTicket.number,
      user_id: selectedTicket.user_id,
      seed: seed,
    };
  }

  // Update draw with winner
  await updateRaffleDrawWinner(draw.id, winningTicket.user_id, winningTicket.id);
  console.log(`🏆 Winner: user_id = ${winningTicket.user_id}, ticket_number = ${winningTicket.number}`);

  // Step 8: Mark raffle as executed
  await updateRaffleStatus(raffle_id, 'executed');
  console.log(`✅ Raffle status updated to: executed`);

  // Step 9: Emit raffle_draw_executed event
  await createEvent({
    event_type: 'raffle_draw_executed',
    version: 'v1',
    payload: {
      raffle_id: raffle_id,
      winning_number: winningTicket.number,
      user_id: winningTicket.user_id,
      seed: seed,
      ticket_count: tickets.length,
    },
    producer: 'raffles',
  });

  console.log(`✨ Raffle draw completed for: ${raffle_id}`);

  // Record metrics
  recordRaffleExecution(tickets.length > 0 ? 'executed' : 'no_tickets');
  logger.info('raffle_execution_completed', 'raffles', `Raffle executed: ${raffle_id}`, undefined, { 
    raffle_id, 
    winning_number: winningTicket?.number,
    winner_user_id: winningTicket?.user_id,
    seed,
    ticket_count: tickets.length 
  });

  return {
    raffle_id: raffle_id,
    winning_number: winningTicket?.number || 0,
    user_id: winningTicket?.user_id || '',
    seed: seed,
  };
}