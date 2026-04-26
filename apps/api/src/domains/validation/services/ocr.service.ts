/**
 * OCR Service
 * Uses configured OCR provider to extract receipt data from proof images.
 * 
 * When OCR is disabled or unavailable, returns a sentinel result that triggers
 * manual_review in the validation pipeline.
 */

import { getOcrProvider } from './providers';
import { OcrResult, OcrInput } from './providers/ocr-provider.interface';

/**
 * Run OCR on a proof image.
 * 
 * @param input - The OCR input with file_url, file_hash, and optional proof_id
 * @returns OcrResult with extracted data or sentinel if OCR is unavailable
 */
export async function runOcr(input: OcrInput): Promise<OcrResult> {
  const provider = getOcrProvider();

  if (!provider) {
    // OCR is not configured - return sentinel
    const reason = !process.env.ANTHROPIC_API_KEY
      ? 'ANTHROPIC_API_KEY not configured'
      : 'T3_OCR_REAL_ENABLED is false';

    return {
      amount: null,
      payment_identifier: null,
      raw_text: '',
      confidence: 0,
      currency: null,
      status: 'unavailable',
      reason,
    };
  }

  try {
    return await provider.extract(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      amount: null,
      payment_identifier: null,
      raw_text: '',
      confidence: 0,
      currency: null,
      status: 'error',
      reason: errorMessage,
    };
  }
}

// Re-export types for consumers
export type { OcrInput, OcrResult } from './providers/ocr-provider.interface';