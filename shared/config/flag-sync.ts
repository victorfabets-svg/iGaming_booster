/**
 * Flag Sync Module
 * Syncs feature flags from database to process.env periodically.
 * Allows flipping flags without restart (Sprint 8 T9).
 */

import { db } from '../database/connection';
import { logger } from '../observability/logger';

const SYNC_INTERVAL_MS = parseInt(
  process.env.FLAG_SYNC_INTERVAL_MS || '30000',
  10
);

let syncTimer: NodeJS.Timeout | null = null;

export async function syncFlagsFromDb(): Promise<void> {
  try {
    const result = await db.query<{ name: string; enabled: boolean }>(
      `SELECT name, enabled FROM infra.feature_flags`
    );
    for (const row of result.rows) {
      process.env[row.name] = row.enabled ? 'true' : 'false';
    }
    logger.info({
      event: 'flag_sync_ok',
      context: 'config',
      data: { flag_count: result.rows.length }
    });
  } catch (err) {
    // Conservative: keep last-known process.env values on failure.
    // Defaults from feature-flags.ts apply if env never set.
    logger.warn({
      event: 'flag_sync_failed',
      context: 'config',
      data: { error: err instanceof Error ? err.message : String(err) }
    });
  }
}

export async function startFlagSync(): Promise<void> {
  await syncFlagsFromDb(); // eager warmup
  syncTimer = setInterval(() => {
    void syncFlagsFromDb();
  }, SYNC_INTERVAL_MS);
  if (typeof syncTimer.unref === 'function') {
    syncTimer.unref();
  }
}

export function stopFlagSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}