/**
 * OCR Cache Repository
 * Stores OCR results by file_hash for deduplication.
 */

import { db } from '@shared/database/connection';
import { OcrResult } from '../services/providers/ocr-provider.interface';

export interface CachedEntry {
  file_hash: string;
  result: OcrResult;
  provider: string;
  model: string;
  expires_at: Date;
}

/**
 * Find a valid (non-expired) cache entry by file_hash.
 * Returns null if not found or expired.
 */
export async function findValid(fileHash: string): Promise<CachedEntry | null> {
  const res = await db.query(
    `SELECT file_hash, result, provider, model, expires_at
     FROM validation.ocr_cache
     WHERE file_hash = $1 AND expires_at > NOW()`,
    [fileHash]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0] as CachedEntry;
}

/**
 * Upsert a cache entry. Uses ON CONFLICT for idempotency.
 */
export async function upsert(
  fileHash: string,
  result: OcrResult,
  provider: string,
  model: string,
  ttlSeconds: number
): Promise<void> {
  await db.query(
    `INSERT INTO validation.ocr_cache 
       (file_hash, result, provider, model, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' seconds')::interval)
     ON CONFLICT (file_hash) DO UPDATE SET
       result = EXCLUDED.result,
       provider = EXCLUDED.provider,
       model = EXCLUDED.model,
       expires_at = EXCLUDED.expires_at`,
    [fileHash, JSON.stringify(result), provider, model, ttlSeconds]
  );
}

/**
 * Record a cache hit and update metrics.
 */
export async function recordHit(fileHash: string, costSavedUsd: number): Promise<void> {
  await db.query(
    `UPDATE validation.ocr_cache 
     SET hit_count = hit_count + 1,
         cost_saved_usd = cost_saved_usd + $2,
         last_hit_at = NOW()
     WHERE file_hash = $1`,
    [fileHash, costSavedUsd]
  );
}
