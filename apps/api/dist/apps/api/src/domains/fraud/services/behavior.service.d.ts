export interface BehaviorAnalysisResult {
    is_suspicious: boolean;
    signals: string[];
    risk_score_modifier: number;
}
export declare class BehaviorAnalysisService {
    private static instance;
    private constructor();
    static getInstance(): BehaviorAnalysisService;
    analyzeBehavior(userId: string, currentProofId?: string): Promise<BehaviorAnalysisResult>;
    private getUserRecentProofs;
    flagFraudDetection(userId: string, proofId: string, reason: string): Promise<void>;
}
export declare const behaviorAnalysisService: BehaviorAnalysisService;
//# sourceMappingURL=behavior.service.d.ts.map