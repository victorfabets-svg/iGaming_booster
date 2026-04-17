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
  
  // Database
  databaseUrl: string;
  
  // API
  apiPort: number;
  apiHost: string;
  
  // Feature flags (runtime-togglable)
  featureFlags: {
    ENABLE_REWARDS: boolean;
    ENABLE_VALIDATION: boolean;
  };
  
  // Limits
  rateLimits: {
    proofsPerHour: number;
    rewardsPerDay: number;
  };
  
  // Validation thresholds
  validation: {
    approvalThreshold: number;
    manualReviewThreshold: number;
  };
  
  // Raffle settings
  raffle: {
    defaultTotalNumbers: number;
    drawDaysInFuture: number;
  };
  
  // Rewards settings
  rewards: {
    costPerTicket: number;
    revenuePerTicket: number;
  };
}

function getEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
}

function getFeatureFlags(): AppConfig['featureFlags'] {
  // SAFE DEFAULTS: All production features disabled until explicitly enabled
  // Only ENABLE_REWARDS and ENABLE_VALIDATION default to true (core functionality)
  // NOTE: ENABLE_AUTOMATIC_APPROVAL removed - thresholds always from config
  return {
    ENABLE_REWARDS: process.env.ENABLE_REWARDS !== 'false',
    ENABLE_VALIDATION: process.env.ENABLE_VALIDATION !== 'false',
  };
}

function getRateLimits(): AppConfig['rateLimits'] {
  return {
    proofsPerHour: parseInt(process.env.RATE_LIMIT_PROOFS_PER_HOUR || '5', 10),
    rewardsPerDay: parseInt(process.env.RATE_LIMIT_REWARDS_PER_DAY || '10', 10),
  };
}

function getValidationConfig(): AppConfig['validation'] {
  return {
    approvalThreshold: parseFloat(process.env.VALIDATION_APPROVAL_THRESHOLD || '0.9'),
    manualReviewThreshold: parseFloat(process.env.VALIDATION_MANUAL_REVIEW_THRESHOLD || '0.6'),
  };
}

function getRaffleConfig(): AppConfig['raffle'] {
  return {
    defaultTotalNumbers: parseInt(process.env.RAFFLE_DEFAULT_TOTAL_NUMBERS || '1000', 10),
    drawDaysInFuture: parseInt(process.env.RAFFLE_DRAW_DAYS_IN_FUTURE || '30', 10),
  };
}

function getRewardsConfig(): AppConfig['rewards'] {
  return {
    costPerTicket: parseFloat(process.env.REWARD_COST_PER_TICKET || '0.50'),
    revenuePerTicket: parseFloat(process.env.REWARD_REVENUE_PER_TICKET || '2.00'),
  };
}

// Singleton config instance
class ConfigManager {
  private static instance: AppConfig;
  private initialized = false;

  public constructor() {}

  getConfig(): AppConfig {
    if (!this.initialized) {
      const env = getEnvironment();
      
      ConfigManager.instance = {
        environment: env,
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: env === 'production',
        isDevelopment: env === 'development',
        isTest: env === 'test',
        
        databaseUrl: process.env.NEON_DB_URL,
        
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
  updateFeatureFlag(flag: keyof AppConfig['featureFlags'], value: boolean): void {
    if (ConfigManager.instance) {
      ConfigManager.instance.featureFlags[flag] = value;
    }
  }

  // Get current feature flag state
  getFeatureFlag(flag: keyof AppConfig['featureFlags']): boolean {
    return this.getConfig().featureFlags[flag];
  }

  // Get all feature flags
  getAllFeatureFlags(): AppConfig['featureFlags'] {
    return this.getConfig().featureFlags;
  }
}

export const configManager = new ConfigManager();

// Convenience accessor
export const config = configManager.getConfig();

// Export individual config getters for convenience
export const environment = config.environment;
export const isProduction = config.isProduction;
export const isDevelopment = config.isDevelopment;
export const featureFlags = config.featureFlags;

// NEON database URL - Single Source of Truth (SSOT)

// FAIL FAST: Supabase is forbidden
if (process.env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL is forbidden - use NEON_DB_URL only");
}

if (!process.env.NEON_DB_URL) {
  throw new Error("NEON_DB_URL is required");
}

// SSOT ENFORCEMENT: Strict Neon host pattern validation
let host: string;

try {
  host = new URL(process.env.NEON_DB_URL).hostname;
} catch {
  throw new Error("Invalid NEON_DB_URL format");
}

/**
 * Strict Neon pattern validation:
 * - Must match: ep-<id>.<region>.aws.neon.tech
 * - Prevents: fake.neon.tech, subdomain bypass, etc.
 */
const NEON_HOST_REGEX = /^ep-[a-z0-9]+\.[a-z0-9-]+\.aws\.neon\.tech$/;

if (!NEON_HOST_REGEX.test(host)) {
  throw new Error(`Invalid database host: ${host} — only official Neon endpoints allowed`);
}

// Log active DB host for observability
console.log("🔗 DB_HOST:", host);

export const NEON_DB_URL = process.env.NEON_DB_URL;