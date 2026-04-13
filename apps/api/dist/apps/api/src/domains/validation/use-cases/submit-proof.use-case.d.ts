export interface SubmitProofInput {
    user_id: string;
    file_url: string;
}
export interface SubmitProofResult {
    proof_id: string;
}
export declare function submitProof(input: SubmitProofInput): Promise<SubmitProofResult>;
//# sourceMappingURL=submit-proof.use-case.d.ts.map