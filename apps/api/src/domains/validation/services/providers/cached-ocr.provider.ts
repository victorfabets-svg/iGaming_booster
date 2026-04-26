/**
 * CachedOcrProvider - Decorator that wraps any OcrProvider with file_hash caching.
 * 
 * T4: Cache OCR results by file_hash (sha256 of bytes), 7-day TTL default.
 * - Decorator pattern preserving OcrProvider interface
 * - Flag-gated, default OFF, fail-open behavior
 * - Tracks hit_count + cost_saved_usd per cache row
 */

import { OcrProvider, OcrInput, OcrResult } from './ocr-provider.interface';
import * as cacheRepo from '../../repositories/ocr-cache.repository';
import { logger } from '@shared/observability/logger';
import * as crypto from 'crypto';

/**
 * Estimate cost savings per cache hit.
 * Haiku 4.5: ~1500 input tokens (image) + ~150 output tokens avg
 * Cost: (1500/1M)*1.0 + (150/1M)*5.0 = $0.0015 + $0.00075 ≈ $0.00225
 */
function estimateCostSavings(): number {
  return 0.00225;
}

export class CachedOcrProvider implements OcrProvider {
  readonly name: string;

  constructor(
    private inner: OcrProvider,
    private ttlSeconds: number
  ) {
    this.name = `cached-${inner.name}`;
  }

  async extract(input: OcrInput): Promise<OcrResult> {
    // 1. Fetch + hash (need hash to lookup cache; bytes reused on miss)
    let bytes: Buffer;
    let mediaType: 'image/jpeg' | 'image/png';
    let fileHash: string;
    try {
      const fetched = await this.fetchImage(input.file_url);
      bytes = fetched.bytes;
      mediaType = this.getMediaType(input.file_url);
      fileHash = fetched.hash;
    } catch (err) {
      // Fetch error: delegate to inner so its catch handles it consistently
      return this.inner.extract(input);
    }

    // 2. Cache lookup (fail-open: any error → treat as miss)
    let cached: cacheRepo.CachedEntry | null = null;
    try {
      cached = await cacheRepo.findValid(fileHash);
    } catch (err) {
      logger.warn({
        event: 'ocr_cache_lookup_failed',
        context: 'validation',
        data: { file_hash: fileHash, error: String(err) },
      });
    }

    if (cached) {
      // Cache hit — record metric + return cached result
      const savedCost = estimateCostSavings();
      try {
        await cacheRepo.recordHit(fileHash, savedCost);
      } catch (err) {
        logger.warn({
          event: 'ocr_cache_hit_record_failed',
          context: 'validation',
          data: { error: String(err) },
        });
      }
      logger.info({
        event: 'ocr_cache_hit',
        context: 'validation',
        data: {
          file_hash: fileHash,
          provider: cached.provider,
          saved_usd: savedCost,
        },
      });
      return cached.result;
    }

    // 3. Cache miss — call inner with same file URL (inner handles fetch)
    // Note: we call inner.extract which will fetch again, but this is acceptable
    // because we need to keep the interface simple (inner owns the fetch logic)
    const result = await this.inner.extract(input);

    // 4. Cache successful results only (fail-open)
    if (result.status === 'success') {
      try {
        await cacheRepo.upsert(
          fileHash,
          result,
          this.inner.name,
          'claude-haiku-4-5',
          this.ttlSeconds
        );
      } catch (err) {
        logger.warn({
          event: 'ocr_cache_write_failed',
          context: 'validation',
          data: { error: String(err) },
        });
      }
    }

    return result;
  }

  private async fetchImage(url: string): Promise<{ bytes: Buffer; hash: string }> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`fetch failed ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    return { bytes, hash };
  }

  private getMediaType(url: string): 'image/jpeg' | 'image/png' {
    return url.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
  }
}
