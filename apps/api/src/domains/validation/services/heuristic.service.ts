import { OcrResult } from './providers/ocr-provider.interface';

export interface HeuristicResult {
  is_valid: boolean;
  issues: string[];
}

/**
 * Heuristic Validation Service
 * Validates OCR output for required fields and basic consistency
 */
export function validateWithHeuristics(ocrResult: OcrResult): HeuristicResult {
  const issues: string[] = [];

  // Check required fields
  if (!ocrResult.amount || ocrResult.amount <= 0) {
    issues.push('Amount must be greater than 0');
  }

  // New OCR result doesn't include date/institution - skip those checks
  // They were part of the old mock OCR that is now deprecated

  // Check amount is within reasonable range
  if (ocrResult.amount && ocrResult.amount > 100000) {
    issues.push('Amount exceeds maximum allowed value');
  }

  return {
    is_valid: issues.length === 0,
    issues,
  };
}