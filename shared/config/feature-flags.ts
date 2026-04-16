/**
 * Feature Flags System
 * Runtime-togglable features for safe deployment control
 */

import { configManager, AppConfig } from './env';

export type FeatureFlag = keyof AppConfig['featureFlags'];

export interface FeatureFlagState {
  flag: FeatureFlag;
  enabled: boolean;
  canToggle: boolean;
}

// Feature flag definitions with metadata
// SAFE DEFAULTS: All production features disabled until explicitly enabled
const FEATURE_FLAG_DEFINITIONS: Record<FeatureFlag, { 
  description: string; 
  defaultValue: boolean;
  critical: boolean;
}> = {
  ENABLE_REWARDS: {
    description: 'Enable reward generation for approved validations',
    defaultValue: true,
    critical: true, // Disabling stops reward generation
  },
  ENABLE_VALIDATION: {
    description: 'Enable automatic validation processing',
    defaultValue: true,
    critical: true, // Disabling stops all validation
  },
  ENABLE_AUTOMATIC_APPROVAL: {
    description: 'Enable automatic approval for high-confidence validations - if false, default to manual_review',
    defaultValue: false, // SAFE DEFAULT: require manual review unless explicitly enabled
    critical: false,
  },
  ENABLE_RAFFLE: {
    description: 'Enable raffle system for promotional drawings',
    defaultValue: false, // SAFE DEFAULT: disabled until explicitly enabled
    critical: false,
  },
};

class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private listeners: Set<(flag: FeatureFlag, enabled: boolean) => void> = new Set();

  private constructor() {}

  static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  isEnabled(flag: FeatureFlag): boolean {
    return configManager.getFeatureFlag(flag);
  }

  isDisabled(flag: FeatureFlag): boolean {
    return !configManager.getFeatureFlag(flag);
  }

  enable(flag: FeatureFlag): boolean {
    if (!this.canToggle(flag)) {
      console.warn(`Cannot enable ${flag}: feature is locked`);
      return false;
    }

    configManager.updateFeatureFlag(flag, true);
    this.notifyListeners(flag, true);
    console.log(`✅ Feature flag enabled: ${flag}`);
    return true;
  }

  disable(flag: FeatureFlag): boolean {
    if (!this.canToggle(flag)) {
      console.warn(`Cannot disable ${flag}: feature is locked`);
      return false;
    }

    configManager.updateFeatureFlag(flag, false);
    this.notifyListeners(flag, false);
    console.log(`❌ Feature flag disabled: ${flag}`);
    return true;
  }

  toggle(flag: FeatureFlag): boolean {
    if (this.isEnabled(flag)) {
      return this.disable(flag);
    } else {
      return this.enable(flag);
    }
  }

  getState(flag: FeatureFlag): FeatureFlagState {
    const def = FEATURE_FLAG_DEFINITIONS[flag];
    return {
      flag,
      enabled: this.isEnabled(flag),
      canToggle: true, // Could be enhanced with DB-backed locking
    };
  }

  getAllStates(): FeatureFlagState[] {
    return Object.keys(FEATURE_FLAG_DEFINITIONS).map(flag => 
      this.getState(flag as FeatureFlag)
    );
  }

  getDefinition(flag: FeatureFlag) {
    return FEATURE_FLAG_DEFINITIONS[flag];
  }

  canToggle(flag: FeatureFlag): boolean {
    // In production, critical features might require additional checks
    return true;
  }

  // Subscribe to flag changes
  onChange(listener: (flag: FeatureFlag, enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(flag: FeatureFlag, enabled: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(flag, enabled);
      } catch (err) {
        console.error('Error in feature flag listener:', err);
      }
    });
  }

  // Check multiple flags at once
  isEnabledAll(flags: FeatureFlag[]): boolean {
    return flags.every(flag => this.isEnabled(flag));
  }

  isEnabledAny(flags: FeatureFlag[]): boolean {
    return flags.some(flag => this.isEnabled(flag));
  }

  // Log all feature flags (useful for startup)
  logAllFlags(): void {
    console.log('📋 Feature Flags:');
    for (const [flag, def] of Object.entries(FEATURE_FLAG_DEFINITIONS)) {
      const state = this.getState(flag as FeatureFlag);
      console.log(`   ${state.enabled ? '✅' : '❌'} ${flag}: ${def.description}`);
    }
  }
}

export const featureFlags = FeatureFlagsService.getInstance();

// Convenience functions
export const isRewardsEnabled = () => featureFlags.isEnabled('ENABLE_REWARDS');
export const isValidationEnabled = () => featureFlags.isEnabled('ENABLE_VALIDATION');
export const isAutomaticApprovalEnabled = () => featureFlags.isEnabled('ENABLE_AUTOMATIC_APPROVAL');
export const isRaffleEnabled = () => featureFlags.isEnabled('ENABLE_RAFFLE');

// Guard functions that throw if disabled
export function requireRewards(): void {
  if (isRewardsEnabled()) return;
  throw new Error('Rewards are currently disabled');
}

export function requireValidation(): void {
  if (isValidationEnabled()) return;
  throw new Error('Validation is currently disabled');
}