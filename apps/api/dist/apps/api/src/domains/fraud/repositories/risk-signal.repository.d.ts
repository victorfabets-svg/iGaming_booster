export interface RiskSignal {
    id: string;
    user_id: string;
    signal_type: string;
    value: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
}
export interface CreateRiskSignalInput {
    user_id: string;
    signal_type: string;
    value: string;
    metadata?: Record<string, unknown>;
}
export declare function createRiskSignal(input: CreateRiskSignalInput): Promise<RiskSignal>;
export declare function findRiskSignalsByUserId(userId: string, limit?: number): Promise<RiskSignal[]>;
export declare function findRiskSignalsByType(signalType: string, since: Date): Promise<RiskSignal[]>;
export declare function countRiskSignalsByUser(userId: string, signalType?: string, since?: Date): Promise<number>;
//# sourceMappingURL=risk-signal.repository.d.ts.map