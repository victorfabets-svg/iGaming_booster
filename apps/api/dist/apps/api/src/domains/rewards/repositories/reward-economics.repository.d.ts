export interface RewardEconomics {
    id: string;
    reward_id: string;
    cost: number;
    estimated_revenue: number;
    margin: number;
    created_at: Date;
}
export interface CreateRewardEconomicsInput {
    reward_id: string;
    cost: number;
    estimated_revenue: number;
}
export declare function createRewardEconomics(input: CreateRewardEconomicsInput): Promise<RewardEconomics>;
export declare function findRewardEconomicsByRewardId(rewardId: string): Promise<RewardEconomics | null>;
export declare function getTotalEconomics(): Promise<{
    total_cost: number;
    total_revenue: number;
    total_margin: number;
    reward_count: number;
}>;
//# sourceMappingURL=reward-economics.repository.d.ts.map