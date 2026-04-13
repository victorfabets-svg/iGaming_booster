import { ProofInput } from '../domain/proof';
export interface CreateProofResult {
    proof_id: string;
    status: string;
    file_url?: string;
    expires_in?: number;
}
export declare function createProofUseCase(input: ProofInput): Promise<CreateProofResult>;
//# sourceMappingURL=createProofUseCase.d.ts.map