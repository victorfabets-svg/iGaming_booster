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
    ENABLE_RAFFLE: boolean;
    ENABLE_AUTOMATIC_APPROVAL: boolean;
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
  
  // Storage (R2) settings
  storage: {
    r2Endpoint: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    r2Bucket: string;
    r2Region: string;
  };
  
  // JWT settings
  jwt: {
    secret: string;
  };
}

function getEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
}

function getFeatureFlags(): AppConfig['featureFlags'] {
  return {
    ENABLE_REWARDS: process.env.ENABLE_REWARDS !== 'false',
    ENABLE_VALIDATION: process.env.ENABLE_VALIDATION !== 'false',
    ENABLE_RAFFLE: process.env.ENABLE_RAFFLE !== 'false',
    ENABLE_AUTOMATIC_APPROVAL: process.env.ENABLE_AUTOMATIC_APPROVAL !== 'false',
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

function getStorageConfig(): AppConfig['storage'] {
  return {
    r2Endpoint: process.env.R2_ENDPOINT || '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    r2Bucket: process.env.R2_BUCKET || 'igamingbooster',
    r2Region: process.env.R2_REGION || 'auto',
  };
}

function getJwtConfig(): AppConfig['jwt'] {
  return {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  };
}

// Singleton config instance
class ConfigManager {
  private static instance: AppConfig;
  private initialized = false;

  constructor() {}

  static getInstance(): ConfigManager {
    return new ConfigManager();
  }

  getConfig(): AppConfig {
    if (!this.initialized) {
      const env = getEnvironment();
      
      // Validate required environment variables
      if (!process.env.NEON_DB_URL) {
        throw new Error("NEON_DB_URL is not set");
      }
      
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
        
        storage: getStorageConfig(),
        
        jwt: getJwtConfig(),
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