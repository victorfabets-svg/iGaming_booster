/**
 * Feature Flags System
 * Runtime-togglable features for safe deployment control
 */
import { AppConfig } from './env';
export type FeatureFlag = keyof AppConfig['featureFlags'];
export interface FeatureFlagState {
    flag: FeatureFlag;
    enabled: boolean;
    canToggle: boolean;
}
declare class FeatureFlagsService {
    private static instance;
    private listeners;
    private constructor();
    static getInstance(): FeatureFlagsService;
    isEnabled(flag: FeatureFlag): boolean;
    isDisabled(flag: FeatureFlag): boolean;
    enable(flag: FeatureFlag): boolean;
    disable(flag: FeatureFlag): boolean;
    toggle(flag: FeatureFlag): boolean;
    getState(flag: FeatureFlag): FeatureFlagState;
    getAllStates(): FeatureFlagState[];
    getDefinition(flag: FeatureFlag): {
        description: string;
        defaultValue: boolean;
        critical: boolean;
    };
    canToggle(flag: FeatureFlag): boolean;
    onChange(listener: (flag: FeatureFlag, enabled: boolean) => void): () => void;
    private notifyListeners;
    isEnabledAll(flags: FeatureFlag[]): boolean;
    isEnabledAny(flags: FeatureFlag[]): boolean;
    logAllFlags(): void;
}
export declare const featureFlags: FeatureFlagsService;
export declare const isRewardsEnabled: () => boolean;
export declare const isValidationEnabled: () => boolean;
export declare const isRaffleEnabled: () => boolean;
export declare const isAutomaticApprovalEnabled: () => boolean;
export declare function requireRewards(): void;
export declare function requireValidation(): void;
export declare function requireRaffle(): void;
export {};
//# sourceMappingURL=feature-flags.d.ts.map