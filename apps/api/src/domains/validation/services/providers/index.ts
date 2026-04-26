/**
 * OCR Provider Factory
 * Returns the configured OCR provider based on feature flags and environment.
 */

import { OcrProvider } from './ocr-provider.interface';
import { AnthropicOcrProvider } from './anthropic-ocr.provider';
import { CachedOcrProvider } from './cached-ocr.provider';
import { getFlag } from '@shared/config/feature-flags';

/**
 * Get the configured OCR provider.
 * Returns null if OCR is disabled or API key is not configured.
 * 
 * Configuration:
 * - T3_OCR_REAL_ENABLED must be true
 * - ANTHROPIC_API_KEY must be set in environment
 * - T4_OCR_CACHE_ENABLED (optional): wraps with cache for deduplication
 */
export function getOcrProvider(): OcrProvider | null {
  // Check if OCR is enabled via feature flag
  if (!getFlag('T3_OCR_REAL_ENABLED')) {
    return null;
  }

  // Check if API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  const inner = new AnthropicOcrProvider(apiKey);

  // T4: wrap with cache if flag enabled
  if (!getFlag('T4_OCR_CACHE_ENABLED')) {
    return inner; // no cache, behavior identical to Sprint 9
  }

  const ttlDays = parseInt(process.env.T4_OCR_CACHE_TTL_DAYS || '7', 10);
  const ttlSeconds = Math.max(60, ttlDays * 24 * 3600);
  return new CachedOcrProvider(inner, ttlSeconds);
}