"use strict";
/**
 * Environment Initialization
 * Logs environment and feature flags on startup
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAutomaticApprovalEnabled = exports.isRaffleEnabled = exports.isValidationEnabled = exports.isRewardsEnabled = exports.ff = exports.featureFlags = exports.isDevelopment = exports.isProduction = exports.environment = exports.config = void 0;
exports.initializeEnvironment = initializeEnvironment;
const env_1 = require("./env");
const feature_flags_1 = require("./feature-flags");
const observability_1 = require("../observability");
function initializeEnvironment() {
    // Log environment info
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 iGaming Booster API - Environment Initialization');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📦 Node Environment: ${env_1.config.nodeEnv}`);
    console.log(`🌍 App Environment: ${env_1.environment}`);
    console.log(`🏭 Production: ${env_1.isProduction}`);
    console.log(`💻 Development: ${env_1.isDevelopment}`);
    console.log('\n📋 Configuration:');
    console.log(`   Port: ${env_1.config.apiPort}`);
    console.log(`   Host: ${env_1.config.apiHost}`);
    if (env_1.config.databaseUrl) {
        // Mask password in connection string for logging
        const maskedDbUrl = env_1.config.databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
        console.log(`   Database: ${maskedDbUrl}`);
    }
    console.log('\n⚡ Rate Limits:');
    console.log(`   Proofs per hour: ${env_1.config.rateLimits.proofsPerHour}`);
    console.log(`   Rewards per day: ${env_1.config.rateLimits.rewardsPerDay}`);
    console.log('\n🎯 Validation Thresholds:');
    console.log(`   Approval: ${env_1.config.validation.approvalThreshold}`);
    console.log(`   Manual Review: ${env_1.config.validation.manualReviewThreshold}`);
    console.log('\n🎰 Raffle Settings:');
    console.log(`   Default total numbers: ${env_1.config.raffle.defaultTotalNumbers}`);
    console.log(`   Draw days in future: ${env_1.config.raffle.drawDaysInFuture}`);
    // Log feature flags using the feature flags service
    console.log('\n📋 Feature Flags:');
    feature_flags_1.featureFlags.logAllFlags();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Environment initialized');
    console.log('═══════════════════════════════════════════════════════════');
    // Log to structured logger as well
    observability_1.logger.info('environment_initialized', 'system', `Environment: ${env_1.environment}, Node: ${env_1.config.nodeEnv}`, undefined, {
        environment: env_1.environment,
        nodeEnv: env_1.config.nodeEnv,
        isProduction: env_1.isProduction,
        featureFlags: env_1.config.featureFlags,
        rateLimits: env_1.config.rateLimits,
        validation: env_1.config.validation,
        raffle: env_1.config.raffle,
    });
}
// Export config for use throughout the application
var env_2 = require("./env");
Object.defineProperty(exports, "config", { enumerable: true, get: function () { return env_2.config; } });
Object.defineProperty(exports, "environment", { enumerable: true, get: function () { return env_2.environment; } });
Object.defineProperty(exports, "isProduction", { enumerable: true, get: function () { return env_2.isProduction; } });
Object.defineProperty(exports, "isDevelopment", { enumerable: true, get: function () { return env_2.isDevelopment; } });
Object.defineProperty(exports, "featureFlags", { enumerable: true, get: function () { return env_2.featureFlags; } });
var feature_flags_2 = require("./feature-flags");
Object.defineProperty(exports, "ff", { enumerable: true, get: function () { return feature_flags_2.featureFlags; } });
Object.defineProperty(exports, "isRewardsEnabled", { enumerable: true, get: function () { return feature_flags_2.isRewardsEnabled; } });
Object.defineProperty(exports, "isValidationEnabled", { enumerable: true, get: function () { return feature_flags_2.isValidationEnabled; } });
Object.defineProperty(exports, "isRaffleEnabled", { enumerable: true, get: function () { return feature_flags_2.isRaffleEnabled; } });
Object.defineProperty(exports, "isAutomaticApprovalEnabled", { enumerable: true, get: function () { return feature_flags_2.isAutomaticApprovalEnabled; } });
//# sourceMappingURL=index.js.map