import { OcrResult } from './ocr.service';
export interface HeuristicResult {
    is_valid: boolean;
    issues: string[];
}
/**
 * Heuristic Validation Service
 * Validates OCR output for required fields and basic consistency
 */
export declare function validateWithHeuristics(ocrResult: OcrResult): HeuristicResult;
//# sourceMappingURL=heuristic.service.d.ts.map