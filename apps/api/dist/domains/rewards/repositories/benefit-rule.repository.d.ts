export interface BenefitRule {
    id: string;
    min_amount: number;
    numbers_generated: number;
    access_days: number;
    version: string;
    risk_multiplier?: number;
    max_per_user?: number;
    dynamic_flag?: boolean;
}
export declare function findBenefitRuleByAmount(amount: number): Promise<BenefitRule | null>;
export declare function findDynamicBenefitRule(amount: number): Promise<BenefitRule | null>;
export declare function getAllBenefitRules(): Promise<BenefitRule[]>;
export declare function createBenefitRule(input: Omit<BenefitRule, 'id'>): Promise<BenefitRule>;
//# sourceMappingURL=benefit-rule.repository.d.ts.map