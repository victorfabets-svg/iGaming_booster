/**
 * OCR Provider Factory
 * Returns the configured OCR provider based on feature flags and environment.
 */

import { OcrProvider } from './ocr-provider.interface';
import { AnthropicOcrProvider } from './anthropic-ocr.provider';
import { getFlag } from '@shared/config/feature-flags';

/**
 * Get the configured OCR provider.
 * Returns null if OCR is disabled or API key is not configured.
 * 
 * Configuration:
 * - T3_OCR_REAL_ENABLED must be true
 * - ANTHROPIC_API_KEY must be set in environment
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

  // Return the Anthropic provider
  return new AnthropicOcrProvider(apiKey);
}