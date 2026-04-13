export interface ProofSubmittedEventPayload {
    proof_id: string;
    user_id: string;
    file_url: string;
    submitted_at: string;
}
export declare function processProofSubmitted(payload: ProofSubmittedEventPayload): Promise<void>;
//# sourceMappingURL=process-proof-submitted.use-case.d.ts.map