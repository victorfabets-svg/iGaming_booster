export interface Proof {
    id: string;
    user_id: string;
    file_url: string;
    hash: string;
    submitted_at: string;
}
export interface ProofInput {
    user_id: string;
    file_buffer: Buffer;
}
export interface ProofResult {
    proof: Proof;
    isNew: boolean;
}
//# sourceMappingURL=proof.d.ts.map