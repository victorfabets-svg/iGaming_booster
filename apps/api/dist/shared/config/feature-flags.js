"use strict";
/**
 * Feature Flags System
 * Runtime-togglable features for safe deployment control
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAutomaticApprovalEnabled = exports.isRaffleEnabled = exports.isValidationEnabled = exports.isRewardsEnabled = exports.featureFlags = void 0;
exports.requireRewards = requireRewards;
exports.requireValidation = requireValidation;
exports.requireRaffle = requireRaffle;
const env_1 = require("./env");
// Feature flag definitions with metadata
const FEATURE_FLAG_DEFINITIONS = {
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
    ENABLE_RAFFLE: {
        description: 'Enable raffle execution and drawing',
        defaultValue: true,
        critical: false,
    },
    ENABLE_AUTOMATIC_APPROVAL: {
        description: 'Enable automatic approval for high-confidence validations',
        defaultValue: true,
        critical: false,
    },
};
class FeatureFlagsService {
    constructor() {
        this.listeners = new Set();
    }
    static getInstance() {
        if (!FeatureFlagsService.instance) {
            FeatureFlagsService.instance = new FeatureFlagsService();
        }
        return FeatureFlagsService.instance;
    }
    isEnabled(flag) {
        return env_1.configManager.getFeatureFlag(flag);
    }
    isDisabled(flag) {
        return !env_1.configManager.getFeatureFlag(flag);
    }
    enable(flag) {
        if (!this.canToggle(flag)) {
            console.warn(`Cannot enable ${flag}: feature is locked`);
            return false;
        }
        env_1.configManager.updateFeatureFlag(flag, true);
        this.notifyListeners(flag, true);
        console.log(`✅ Feature flag enabled: ${flag}`);
        return true;
    }
    disable(flag) {
        if (!this.canToggle(flag)) {
            console.warn(`Cannot disable ${flag}: feature is locked`);
            return false;
        }
        env_1.configManager.updateFeatureFlag(flag, false);
        this.notifyListeners(flag, false);
        console.log(`❌ Feature flag disabled: ${flag}`);
        return true;
    }
    toggle(flag) {
        if (this.isEnabled(flag)) {
            return this.disable(flag);
        }
        else {
            return this.enable(flag);
        }
    }
    getState(flag) {
        const def = FEATURE_FLAG_DEFINITIONS[flag];
        return {
            flag,
            enabled: this.isEnabled(flag),
            canToggle: true, // Could be enhanced with DB-backed locking
        };
    }
    getAllStates() {
        return Object.keys(FEATURE_FLAG_DEFINITIONS).map(flag => this.getState(flag));
    }
    getDefinition(flag) {
        return FEATURE_FLAG_DEFINITIONS[flag];
    }
    canToggle(flag) {
        // In production, critical features might require additional checks
        return true;
    }
    // Subscribe to flag changes
    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notifyListeners(flag, enabled) {
        this.listeners.forEach(listener => {
            try {
                listener(flag, enabled);
            }
            catch (err) {
                console.error('Error in feature flag listener:', err);
            }
        });
    }
    // Check multiple flags at once
    isEnabledAll(flags) {
        return flags.every(flag => this.isEnabled(flag));
    }
    isEnabledAny(flags) {
        return flags.some(flag => this.isEnabled(flag));
    }
    // Log all feature flags (useful for startup)
    logAllFlags() {
        console.log('📋 Feature Flags:');
        for (const [flag, def] of Object.entries(FEATURE_FLAG_DEFINITIONS)) {
            const state = this.getState(flag);
            console.log(`   ${state.enabled ? '✅' : '❌'} ${flag}: ${def.description}`);
        }
    }
}
exports.featureFlags = FeatureFlagsService.getInstance();
// Convenience functions
const isRewardsEnabled = () => exports.featureFlags.isEnabled('ENABLE_REWARDS');
exports.isRewardsEnabled = isRewardsEnabled;
const isValidationEnabled = () => exports.featureFlags.isEnabled('ENABLE_VALIDATION');
exports.isValidationEnabled = isValidationEnabled;
const isRaffleEnabled = () => exports.featureFlags.isEnabled('ENABLE_RAFFLE');
exports.isRaffleEnabled = isRaffleEnabled;
const isAutomaticApprovalEnabled = () => exports.featureFlags.isEnabled('ENABLE_AUTOMATIC_APPROVAL');
exports.isAutomaticApprovalEnabled = isAutomaticApprovalEnabled;
// Guard functions that throw if disabled
function requireRewards() {
    if ((0, exports.isRewardsEnabled)())
        return;
    throw new Error('Rewards are currently disabled');
}
function requireValidation() {
    if ((0, exports.isValidationEnabled)())
        return;
    throw new Error('Validation is currently disabled');
}
function requireRaffle() {
    if ((0, exports.isRaffleEnabled)())
        return;
    throw new Error('Raffle is currently disabled');
}
//# sourceMappingURL=feature-flags.js.map