export interface SubmitProofRequest {
    user_id: string;
    file_url: string;
}
export interface SubmitProofResponse {
    proof_id: string;
}
export declare function handleSubmitProof(body: SubmitProofRequest): Promise<SubmitProofResponse>;
export declare function createSubmitProofController(): (req: {
    body: SubmitProofRequest;
}) => Promise<SubmitProofResponse>;
//# sourceMappingURL=submit-proof.controller.d.ts.map