/**
 * Environment Configuration
 * Manages environment-specific settings
 */
export type Environment = 'development' | 'production' | 'test';
export interface AppConfig {
    environment: Environment;
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
    databaseUrl: string;
    apiPort: number;
    apiHost: string;
    featureFlags: {
        ENABLE_REWARDS: boolean;
        ENABLE_VALIDATION: boolean;
        ENABLE_RAFFLE: boolean;
        ENABLE_AUTOMATIC_APPROVAL: boolean;
    };
    rateLimits: {
        proofsPerHour: number;
        rewardsPerDay: number;
    };
    validation: {
        approvalThreshold: number;
        manualReviewThreshold: number;
    };
    raffle: {
        defaultTotalNumbers: number;
        drawDaysInFuture: number;
    };
    rewards: {
        costPerTicket: number;
        revenuePerTicket: number;
    };
}
declare class ConfigManager {
    private static instance;
    private initialized;
    constructor();
    static getInstance(): ConfigManager;
    getConfig(): AppConfig;
    updateFeatureFlag(flag: keyof AppConfig['featureFlags'], value: boolean): void;
    getFeatureFlag(flag: keyof AppConfig['featureFlags']): boolean;
    getAllFeatureFlags(): AppConfig['featureFlags'];
}
export declare const configManager: ConfigManager;
export declare const config: AppConfig;
export declare const environment: Environment;
export declare const isProduction: boolean;
export declare const isDevelopment: boolean;
export declare const featureFlags: {
    ENABLE_REWARDS: boolean;
    ENABLE_VALIDATION: boolean;
    ENABLE_RAFFLE: boolean;
    ENABLE_AUTOMATIC_APPROVAL: boolean;
};
export {};
//# sourceMappingURL=env.d.ts.map