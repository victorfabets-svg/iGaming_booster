export interface ProofValidatedEventPayload {
    proof_id: string;
    user_id: string;
    file_url: string;
    submitted_at: string;
    validation_id: string;
    status: string;
    confidence_score: number;
}
export declare function processReward(payload: ProofValidatedEventPayload): Promise<void>;
//# sourceMappingURL=process-reward.use-case.d.ts.map