export interface Proof {
    id: string;
    user_id: string;
    file_url: string;
    hash: string;
    submitted_at: Date;
}
export interface CreateProofInput {
    user_id: string;
    file_url: string;
    hash: string;
}
export declare function createProof(input: CreateProofInput): Promise<Proof>;
export declare function findProofByHash(hash: string): Promise<Proof | null>;
export declare function findProofById(id: string): Promise<Proof | null>;
export declare function findProofsByUserId(userId: string): Promise<Proof[]>;
//# sourceMappingURL=proof.repository.d.ts.map