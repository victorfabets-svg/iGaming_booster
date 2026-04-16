"use strict";
/**
 * Environment Configuration
 * Manages environment-specific settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlags = exports.isDevelopment = exports.isProduction = exports.environment = exports.config = exports.configManager = void 0;
function getEnvironment() {
    const env = process.env.NODE_ENV?.toLowerCase();
    if (env === 'production')
        return 'production';
    if (env === 'test')
        return 'test';
    return 'development';
}
function getFeatureFlags() {
    return {
        ENABLE_REWARDS: process.env.ENABLE_REWARDS !== 'false',
        ENABLE_VALIDATION: process.env.ENABLE_VALIDATION !== 'false',
        ENABLE_RAFFLE: process.env.ENABLE_RAFFLE !== 'false',
        ENABLE_AUTOMATIC_APPROVAL: process.env.ENABLE_AUTOMATIC_APPROVAL !== 'false',
    };
}
function getRateLimits() {
    return {
        proofsPerHour: parseInt(process.env.RATE_LIMIT_PROOFS_PER_HOUR || '5', 10),
        rewardsPerDay: parseInt(process.env.RATE_LIMIT_REWARDS_PER_DAY || '10', 10),
    };
}
function getValidationConfig() {
    return {
        approvalThreshold: parseFloat(process.env.VALIDATION_APPROVAL_THRESHOLD || '0.9'),
        manualReviewThreshold: parseFloat(process.env.VALIDATION_MANUAL_REVIEW_THRESHOLD || '0.6'),
    };
}
function getRaffleConfig() {
    return {
        defaultTotalNumbers: parseInt(process.env.RAFFLE_DEFAULT_TOTAL_NUMBERS || '1000', 10),
        drawDaysInFuture: parseInt(process.env.RAFFLE_DRAW_DAYS_IN_FUTURE || '30', 10),
    };
}
function getRewardsConfig() {
    return {
        costPerTicket: parseFloat(process.env.REWARD_COST_PER_TICKET || '0.50'),
        revenuePerTicket: parseFloat(process.env.REWARD_REVENUE_PER_TICKET || '2.00'),
    };
}
// Singleton config instance
class ConfigManager {
    constructor() {
        this.initialized = false;
    }
    static getInstance() {
        return new ConfigManager();
    }
    getConfig() {
        if (!this.initialized) {
            const env = getEnvironment();
            ConfigManager.instance = {
                environment: env,
                nodeEnv: process.env.NODE_ENV || 'development',
                isProduction: env === 'production',
                isDevelopment: env === 'development',
                isTest: env === 'test',
                databaseUrl: process.env.NEON_DB_URL || process.env.DATABASE_URL || '',
                apiPort: parseInt(process.env.PORT || '3000', 10),
                apiHost: process.env.API_HOST || '0.0.0.0',
                featureFlags: getFeatureFlags(),
                rateLimits: getRateLimits(),
                validation: getValidationConfig(),
                raffle: getRaffleConfig(),
                rewards: getRewardsConfig(),
            };
            this.initialized = true;
        }
        return ConfigManager.instance;
    }
    // Allow runtime updates to feature flags
    updateFeatureFlag(flag, value) {
        if (ConfigManager.instance) {
            ConfigManager.instance.featureFlags[flag] = value;
        }
    }
    // Get current feature flag state
    getFeatureFlag(flag) {
        return this.getConfig().featureFlags[flag];
    }
    // Get all feature flags
    getAllFeatureFlags() {
        return this.getConfig().featureFlags;
    }
}
exports.configManager = new ConfigManager();
// Convenience accessor
exports.config = exports.configManager.getConfig();
// Export individual config getters for convenience
exports.environment = exports.config.environment;
exports.isProduction = exports.config.isProduction;
exports.isDevelopment = exports.config.isDevelopment;
exports.featureFlags = exports.config.featureFlags;
//# sourceMappingURL=env.js.map