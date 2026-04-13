/**
 * Environment Initialization
 * Logs environment and feature flags on startup
 */

import { config, environment, isProduction, isDevelopment } from './env';
import { featureFlags } from './feature-flags';
import { logger } from '../observability';

export function initializeEnvironment(): void {
  // Log environment info
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 iGaming Booster API - Environment Initialization');
  console.log('═══════════════════════════════════════════════════════════');
  
  console.log(`📦 Node Environment: ${config.nodeEnv}`);
  console.log(`🌍 App Environment: ${environment}`);
  console.log(`🏭 Production: ${isProduction}`);
  console.log(`💻 Development: ${isDevelopment}`);
  
  console.log('\n📋 Configuration:');
  console.log(`   Port: ${config.apiPort}`);
  console.log(`   Host: ${config.apiHost}`);
  
  if (config.databaseUrl) {
    // Mask password in connection string for logging
    const maskedDbUrl = config.databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    console.log(`   Database: ${maskedDbUrl}`);
  }
  
  console.log('\n⚡ Rate Limits:');
  console.log(`   Proofs per hour: ${config.rateLimits.proofsPerHour}`);
  console.log(`   Rewards per day: ${config.rateLimits.rewardsPerDay}`);
  
  console.log('\n🎯 Validation Thresholds:');
  console.log(`   Approval: ${config.validation.approvalThreshold}`);
  console.log(`   Manual Review: ${config.validation.manualReviewThreshold}`);
  
  console.log('\n🎰 Raffle Settings:');
  console.log(`   Default total numbers: ${config.raffle.defaultTotalNumbers}`);
  console.log(`   Draw days in future: ${config.raffle.drawDaysInFuture}`);
  
  // Log feature flags using the feature flags service
  console.log('\n📋 Feature Flags:');
  featureFlags.logAllFlags();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Environment initialized');
  console.log('═══════════════════════════════════════════════════════════');

  // Log to structured logger as well
  logger.info(
    'environment_initialized',
    'system',
    `Environment: ${environment}, Node: ${config.nodeEnv}`,
    undefined,
    {
      environment,
      nodeEnv: config.nodeEnv,
      isProduction,
      featureFlags: config.featureFlags,
      rateLimits: config.rateLimits,
      validation: config.validation,
      raffle: config.raffle,
    }
  );
}

// Export config for use throughout the application
export { config, environment, isProduction, isDevelopment, featureFlags } from './env';
export { featureFlags as ff, isRewardsEnabled, isValidationEnabled, isRaffleEnabled, isAutomaticApprovalEnabled } from './feature-flags';