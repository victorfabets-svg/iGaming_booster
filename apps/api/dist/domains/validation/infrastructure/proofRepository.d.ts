import { Proof, ProofInput, ProofResult } from '../domain/proof';
export declare function createProof(proof: ProofInput, fileUrl: string, hash: string): Promise<ProofResult>;
export declare function findByHash(hash: string): Promise<Proof | null>;
//# sourceMappingURL=proofRepository.d.ts.map