export interface FraudScore {
    id: string;
    proof_id: string;
    score: number;
    signals: Record<string, unknown>;
    created_at: Date;
}
export interface CreateFraudScoreInput {
    proof_id: string;
    score: number;
    signals: Record<string, unknown>;
}
export declare function createFraudScore(input: CreateFraudScoreInput): Promise<FraudScore>;
export declare function findFraudScoreByProofId(proofId: string): Promise<FraudScore | null>;
//# sourceMappingURL=fraud-score.repository.d.ts.map