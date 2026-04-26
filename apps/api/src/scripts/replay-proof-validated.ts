/**
 * Replay script — backfills proof_validated events for proofs with terminal
 * validation status but no proof_validated event in the outbox.
 *
 * Context: prior to fix/sprint-7-pipeline-emit, the validation aggregator emitted
 * 'proof_rejected' for non-approved decisions (manual_review/rejected). The downstream
 * rewards consumer listens only for 'proof_validated', so the chain stalled. This
 * script restarts the chain for any proof whose decision was already persisted.
 *
 * Side-cleanup: marks legacy 'proof_rejected' events as processed=TRUE so they stop
 * surfacing in the consumer_stalled alert. They had no consumer anyway.
 *
 * Usage:
 *   npm run replay:proof-validated           # dry-run by default
 *   npm run replay:proof-validated -- --apply
 */

import { randomUUID } from 'crypto';
import { db, connectWithRetry, type PoolClient } from '@shared/database/connection';

interface OrphanProof {
  validation_id: string;
  proof_id: string;
  status: 'approved' | 'rejected' | 'manual_review';
  confidence_score: number | null;
  rule_version: string | null;
  decision_reason: string | null;
  user_id: string;
  file_url: string;
  submitted_at: Date;
}

async function findOrphanProofs(client: PoolClient): Promise<OrphanProof[]> {
  const result = await client.query<OrphanProof>(
    `SELECT pv.id AS validation_id,
            pv.proof_id,
            pv.status,
            pv.confidence_score,
            pv.rule_version,
            pv.decision_reason,
            p.user_id,
            p.file_url,
            p.submitted_at
       FROM validation.proof_validations pv
       JOIN validation.proofs p ON p.id = pv.proof_id
      WHERE pv.status IN ('approved', 'rejected', 'manual_review')
        AND NOT EXISTS (
          SELECT 1 FROM events.events e
           WHERE e.event_type = 'proof_validated'
             AND e.payload->>'proof_id' = pv.proof_id::text
        )
      ORDER BY pv.created_at ASC`
  );
  return result.rows;
}

async function emitProofValidated(client: PoolClient, p: OrphanProof): Promise<void> {
  await client.query(
    `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload, created_at)
     VALUES ($1, 'proof_validated', 'v1', 'validation', $2, $3, NOW())`,
    [
      randomUUID(),
      randomUUID(),
      JSON.stringify({
        proof_id: p.proof_id,
        user_id: p.user_id,
        file_url: p.file_url,
        submitted_at: p.submitted_at instanceof Date ? p.submitted_at.toISOString() : p.submitted_at,
        validation_id: p.validation_id,
        status: p.status,
        confidence_score: p.confidence_score,
        rule_version: p.rule_version,
        reason: p.decision_reason,
        replayed: true,
      }),
    ]
  );
}

async function drainLegacyProofRejected(client: PoolClient): Promise<number> {
  const result = await client.query(
    `UPDATE events.events
        SET processed = TRUE
      WHERE event_type = 'proof_rejected'
        AND processed = FALSE`
  );
  return result.rowCount ?? 0;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  console.log('=== replay-proof-validated ===');
  console.log(`mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  await connectWithRetry();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const orphans = await findOrphanProofs(client);
    console.log(`orphan proofs (terminal validation, no proof_validated event): ${orphans.length}`);
    for (const p of orphans) {
      console.log(`  proof_id=${p.proof_id} status=${p.status} validation_id=${p.validation_id}`);
    }

    const stalledRejected = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM events.events
        WHERE event_type = 'proof_rejected' AND processed = FALSE`
    );
    console.log(`legacy proof_rejected events to drain: ${stalledRejected.rows[0].count}`);

    if (!apply) {
      await client.query('ROLLBACK');
      console.log('dry-run: no changes committed. re-run with --apply.');
      return;
    }

    for (const p of orphans) {
      await emitProofValidated(client, p);
    }
    const drained = await drainLegacyProofRejected(client);

    await client.query('COMMIT');
    console.log(`emitted ${orphans.length} proof_validated events`);
    console.log(`drained ${drained} legacy proof_rejected events`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('replay failed, transaction rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
