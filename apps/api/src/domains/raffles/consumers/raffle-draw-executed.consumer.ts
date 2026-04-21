/**
 * Raffle Draw Executed Consumer
 * Listens for raffle_draw_executed events
 * Triggers the actual draw execution
 * 
 * EVENT FLOW:
 * raffle_draw_executed → [this consumer] → executes draw → emits winner_notified
 */

import { fetchAndLockEvents, processEventExactlyOnce, validateEvent, Event } from '@shared/events/event-consumer.repository';
import { getRaffleById } from '../application/get-active-raffle';
import { executeRaffleDraw } from '../use-cases/execute-raffle-draw.use-case';
import { logger } from '@shared/observability/logger';

const EVENT_TYPE = 'raffle_draw_executed';
const EVENT_VERSION = 'v1';
const POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

export const CONSUMER_NAME = 'raffle_draw_executed_consumer';

interface RaffleDrawExecutedPayload {
  raffle_id: string;
}

export async function startRaffleDrawExecutedConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    context: 'raffles',
    data: { event_type: EVENT_TYPE, poll_interval_ms: POLL_INTERVAL_MS }
  });

  await pollEvents();

  setInterval(async () => {
    await pollEvents();
  }, POLL_INTERVAL_MS);
}

async function pollEvents(): Promise<void> {
  try {
    const allEvents = await fetchAndLockEvents(BATCH_SIZE);
    const events = allEvents.filter(e => e.event_type === EVENT_TYPE);

    if (events.length === 0) {
      return;
    }

    logger.info({
      event: 'events_found',
      context: 'raffles',
      data: { event_type: EVENT_TYPE, count: events.length }
    });

    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    logger.error('poll_events_error', 'raffles', `Error polling ${EVENT_TYPE} events: ${error}`);
  }
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id || '';
  const payload = event.payload as RaffleDrawExecutedPayload;

  // Validate event type, version, and payload
  const validationError = validateEvent(event, EVENT_TYPE, EVENT_VERSION, ['raffle_id']);

  if (validationError) {
    logger.info({
      event: 'event_invalid',
      context: 'raffles',
      data: { event_id: eventId, code: validationError.code, message: validationError.message }
    });
    return;
  }

  logger.info({
    event: 'event_processing',
    context: 'raffles',
    data: { event_id: eventId, raffle_id: payload.raffle_id }
  });

  const result = await processEventExactlyOnce(eventId, async (client) => {
    await handleRaffleDrawExecuted(payload, client);
  }, CONSUMER_NAME);

  if (result.skipped) {
    logger.info({ event: 'event_skipped', context: 'raffles', data: { event_id: eventId } });
  } else {
    logger.info({ event: 'event_processed', context: 'raffles', data: { event_id: eventId } });
  }
}

async function handleRaffleDrawExecuted(payload: RaffleDrawExecutedPayload, client: any): Promise<void> {
  const { raffle_id } = payload;

  const raffle = await getRaffleById(raffle_id);

  if (!raffle) {
    throw new Error(`Raffle not found: ${raffle_id}. Cannot execute draw.`);
  }
  if (raffle.status !== 'closed') {
    throw new Error(`Raffle ${raffle_id} must be closed to execute draw, found status: ${raffle.status}`);
  }

  logger.info({
    event: 'draw_triggered',
    context: 'raffles',
    data: { raffle_id }
  });

  const result = await executeRaffleDraw({ raffle_id });

  logger.info({
    event: 'draw_executed',
    context: 'raffles',
    data: { raffle_id, winner: result.winning_ticket_id ?? 'none' }
  });
}

if (require.main === module) {
  startRaffleDrawExecutedConsumer().catch((error) => {
    logger.error('fatal_error', 'raffles', `Fatal error: ${error}`);
    process.exit(1);
  });
}