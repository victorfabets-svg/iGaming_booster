/**
 * Subscription Expired Consumer
 * 
 * Listens to 'subscription_expired' events from outbox and auto-opt-outs
 * the corresponding WhatsApp subscriber.
 * 
 * Idempotent via events.processed_events with consumer_name='subscription_expired_consumer'.
 */

import { db, type PoolClient } from '@shared/database/connection';
import { logger } from '@shared/observability/logger';
import { 
  fetchAndLockEvents, 
  isEventProcessed,
  markEventProcessedWithClient,
  markEventAsProcessedWithClient,
  type Event
} from '@shared/events/event-consumer.repository';
import { optOutByUserIdWithClient } from '../subscribers.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';

const CONSUMER_NAME = 'subscription_expired_consumer';
const EVENT_TYPE = 'subscription_expired';
const POLL_INTERVAL_MS = parseInt(process.env.CONSUMER_POLL_INTERVAL_MS || '1000', 10);
const BATCH_SIZE = 20;

interface SubscriptionExpiredPayload {
  subscription_id: string;
  external_id: string;
  user_id: string | null;  // loose-coupled, can be null
  plan_slug: string;
  expired_at: string;
}

export async function startSubscriptionExpiredConsumer(): Promise<void> {
  logger.info({
    event: 'consumer_starting',
    consumer: CONSUMER_NAME,
    listens_for: EVENT_TYPE,
    poll_interval_ms: POLL_INTERVAL_MS,
  });

  await pollEvents();
  setInterval(async () => { await pollEvents(); }, POLL_INTERVAL_MS);
}

async function pollEvents(): Promise<void> {
  try {
    const events = await fetchAndLockEvents(BATCH_SIZE, [EVENT_TYPE]);
    for (const event of events) {
      await processEvent(event);
    }
  } catch (err) {
    logger.error('consumer_poll_error', CONSUMER_NAME, String(err));
  }
}

async function processEvent(event: Event): Promise<void> {
  const eventId = event.event_id || event.id;
  
  // Idempotency check
  if (await isEventProcessed(eventId, CONSUMER_NAME)) {
    return;
  }

  const payload = event.payload as SubscriptionExpiredPayload;
  
  // No-op if user_id missing (loose coupling)
  if (!payload.user_id) {
    logger.info({
      event: 'subscription_expired_no_user_id',
      consumer: CONSUMER_NAME,
      external_id: payload.external_id,
    });
    await markProcessedNoOp(eventId);
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Mark idempotency record FIRST. Lock on events.events came from
    // fetchAndLockEvents (FOR UPDATE SKIP LOCKED) outside this transaction.
    // processed_events PK (event_id, consumer_name) prevents duplicate processing
    // across worker instances.
    await markEventAsProcessedWithClient(client, eventId, CONSUMER_NAME);

    // Atomic opt-out
    const subscriber = await optOutByUserIdWithClient(
      client, 
      payload.user_id, 
      'subscription_expired'
    );

    if (!subscriber) {
      // No active subscriber for this user_id — no-op
      logger.info({
        event: 'subscription_expired_no_active_subscriber',
        consumer: CONSUMER_NAME,
        user_id: payload.user_id,
      });
      await markEventProcessedWithClient(client, eventId);
      await client.query('COMMIT');
      return;
    }

    // Emit downstream event (same as admin opt-out flow)
    await insertEventInTransaction(
      client,
      'whatsapp_subscriber_opted_out',
      {
        subscriber_id: subscriber.id,
        phone_number: subscriber.phone_number,
        opt_out_reason: 'subscription_expired',
        triggered_by_event_id: eventId,
      },
      'whatsapp'
    );

    await insertAuditInTransaction(
      client,
      'whatsapp_subscriber_opted_out',
      'whatsapp',
      subscriber.id,
      null,
      { 
        opt_out_reason: 'subscription_expired',
        triggered_by_subscription: payload.external_id,
      }
    );

    await markEventProcessedWithClient(client, eventId);
    await client.query('COMMIT');

    logger.info({
      event: 'subscription_expired_opted_out',
      consumer: CONSUMER_NAME,
      subscriber_id: subscriber.id,
      user_id: payload.user_id,
      subscription_external_id: payload.external_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('subscription_expired_processing_error', CONSUMER_NAME, String(err));
    throw err;
  } finally {
    client.release();
  }
}

async function markProcessedNoOp(eventId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await markEventAsProcessedWithClient(client, eventId, CONSUMER_NAME);
    await markEventProcessedWithClient(client, eventId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('mark_processed_noop_error', CONSUMER_NAME, String(err));
  } finally {
    client.release();
  }
}