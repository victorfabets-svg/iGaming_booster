/**
 * OCR Provider Interface
 * Abstraction for OCR services to extract receipt data from proof images.
 * Supports swapping providers (Anthropic, OpenAI, etc.) without changing callers.
 */

export interface OcrInput {
  file_url: string;
  file_hash: string;
  proof_id?: string;
}

export interface OcrResult {
  amount: number | null;
  payment_identifier: string | null;
  raw_text: string;
  confidence: number; // 0..1
  currency: string | null;
  status: 'success' | 'unavailable' | 'error' | 'timeout';
  reason?: string;
}

export interface OcrProvider {
  readonly name: string;
  extract(input: OcrInput): Promise<OcrResult>;
}