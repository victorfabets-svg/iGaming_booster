export interface ProofValidation {
    id: string;
    proof_id: string;
    status: string;
    confidence_score: number | null;
    validation_version: string;
    validated_at: Date | null;
    created_at: Date;
}
export interface CreateProofValidationInput {
    proof_id: string;
    status: string;
    validation_version: string;
}
export declare function createProofValidation(input: CreateProofValidationInput): Promise<ProofValidation>;
export declare function findValidationByProofId(proofId: string): Promise<ProofValidation | null>;
export declare function updateValidationStatus(id: string, status: string, confidenceScore?: number): Promise<void>;
export declare function findProofById(id: string): Promise<{
    id: string;
    user_id: string;
    file_url: string;
} | null>;
//# sourceMappingURL=proof-validation.repository.d.ts.map