export interface Reward {
    id: string;
    user_id: string;
    proof_id: string;
    type: string;
    status: string;
    created_at: Date;
}
export interface CreateRewardInput {
    user_id: string;
    proof_id: string;
    type: string;
    status: string;
}
export declare function createReward(input: CreateRewardInput): Promise<Reward>;
export declare function findRewardByProofId(proofId: string): Promise<Reward | null>;
export declare function findRewardById(id: string): Promise<Reward | null>;
export declare function updateRewardStatus(id: string, status: string): Promise<void>;
//# sourceMappingURL=reward.repository.d.ts.map