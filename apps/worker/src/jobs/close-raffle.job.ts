import { db, getClient, saveEventInTransaction } from '../../../shared/database/connection';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

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
async function closeRaffleInTx(raffleId: string, client: any): Promise<boolean> {
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
    return false;
  }
  
  // Step 3: COUNT after close (race-safe - no new tickets can be added)
  const ticketCountResult = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM raffles.tickets WHERE raffle_id = $1`,
    [raffleId]
  );
  const totalTickets = parseInt(ticketCountResult.rows[0]?.count ?? '0', 10);
  
  // Step 4: Generate deterministic seed
  const seed = crypto.createHash('sha256').update(raffleId + totalTickets).digest('hex');
  
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
  
  console.log(`🔐 Seed persisted for raffle ${raffleId}: ${seed} (${totalTickets} tickets)`);
  console.log(`📤 Emitted raffle_draw_executed event for ${raffleId}`);
  return true;
}

/**
 * Scheduler job: Auto-close raffles where end_at <= now AND status='active'
 * 
 * This runs periodically to ensure raffles close automatically even without external trigger.
 * Uses FOR SHARE to prevent race conditions while allowing concurrent reads.
 */
export async function closeRaffleJob(): Promise<{ closed: number; errors: number }> {
  const client = await getClient();
  let closed = 0;
  let errors = 0;
  
  try {
    await client.query('BEGIN');
    
    // CRITICAL: Use FOR SHARE to prevent race conditions on read
    // This acquires a shared lock that blocks FOR UPDATE but allows other SHARED reads
    const rafflesToClose = await client.query<{ id: string }>(
      `SELECT id FROM raffles.raffles 
       WHERE status = 'active' 
         AND end_at <= NOW()
       FOR SHARE`
    );
    
    console.log(`🔍 Found ${rafflesToClose.rows.length} raffles to auto-close`);
    
    for (const raffle of rafflesToClose.rows) {
      try {
        const success = await closeRaffleInTx(raffle.id, client);
        if (success) {
          closed++;
        }
      } catch (err) {
        console.error(`❌ Error closing raffle ${raffle.id}:`, err);
        errors++;
      }
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Fatal error in close-raffle job:', err);
    throw err;
  } finally {
    client.release();
  }
  
  return { closed, errors };
}

// Run if called directly
if (require.main === module) {
  // Import initDb from shared connection for standalone execution
  import('../../../shared/database/connection').then(async ({ initDb }) => {
    try {
      await initDb();
      const result = await closeRaffleJob();
      console.log(`✅ Job completed: ${result.closed} closed, ${result.errors} errors`);
      process.exit(result.errors > 0 ? 1 : 0);
    } catch (err) {
      console.error('❌ Job failed:', err);
      process.exit(1);
    }
  });
}