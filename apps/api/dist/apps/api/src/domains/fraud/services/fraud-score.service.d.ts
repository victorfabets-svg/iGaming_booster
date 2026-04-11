export interface FraudScoreResult {
    score: number;
    signals: Record<string, unknown>;
}
/**
 * Fraud Scoring Service
 * Generates deterministic fraud score based on OCR and heuristic results
 * Can be adjusted by risk score modifier and payment signals
 */
export declare function calculateFraudScore(ocrResult: {
    amount: number;
    date: string;
    institution: string;
    identifier: string | null;
}, heuristicResult: {
    is_valid: boolean;
    issues: string[];
}, riskScoreModifier?: number, paymentModifier?: number): FraudScoreResult;
//# sourceMappingURL=fraud-score.service.d.ts.map