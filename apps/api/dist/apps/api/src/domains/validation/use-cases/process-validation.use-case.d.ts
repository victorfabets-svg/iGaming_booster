import { OcrResult } from '../../validation/services/ocr.service';
import { HeuristicResult } from '../../validation/services/heuristic.service';
export interface ProcessValidationInput {
    proof_id: string;
    risk_score_modifier?: number;
}
export type ValidationDecision = 'approved' | 'rejected' | 'manual_review';
export interface ProcessValidationResult {
    validation_id: string;
    proof_id: string;
    decision: ValidationDecision;
    confidence_score: number;
    ocr_result: OcrResult;
    heuristic_result: HeuristicResult;
}
export declare function processValidation(input: ProcessValidationInput): Promise<ProcessValidationResult>;
//# sourceMappingURL=process-validation.use-case.d.ts.map