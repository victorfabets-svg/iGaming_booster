/**
 * Structured Logging Utility
 * Standardizes logs across the system with consistent format
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogMetadata {
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  event: string;
  domain: string;
  user_id?: string;
  metadata?: LogMetadata;
  message: string;
}

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIdx = levels.indexOf(this.minLevel);
    const newIdx = levels.indexOf(level);
    if (newIdx >= 0) {
      this.minLevel = level;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIdx = levels.indexOf(this.minLevel);
    const messageIdx = levels.indexOf(level);
    return messageIdx >= currentIdx;
  }

  private formatLog(level: LogLevel, event: string, domain: string, message: string, userId?: string, metadata?: LogMetadata): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      domain,
      user_id: userId,
      metadata,
      message,
    };
  }

  private output(log: StructuredLog): void {
    const output = JSON.stringify(log);
    
    switch (log.level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(event?: string, domain?: string, message?: string, userId?: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const log = this.formatLog(LogLevel.DEBUG, event || 'unknown', domain || 'app', message || event || '', userId, metadata);
      this.output(log);
    }
  }

  info(event: string | Record<string, unknown>, domain?: string, message?: string, userId?: string, metadata?: LogMetadata): void {
    const eventStr = typeof event === 'object' ? String((event as Record<string, unknown>).event || '') : (event as string);
    const domainStr = typeof event === 'object' ? String((event as Record<string, unknown>).context || '') : (domain || 'app');
    const msgStr = typeof event === 'object' ? String((event as Record<string, unknown>).data || '') : (message || eventStr || '');
    const uid = typeof event === 'object' ? (event as Record<string, unknown>).user_id as string | undefined : userId;
    const meta = typeof event === 'object' ? (event as Record<string, unknown>).data as LogMetadata | undefined : metadata;
    
    if (this.shouldLog(LogLevel.INFO)) {
      const log = this.formatLog(LogLevel.INFO, eventStr || 'unknown', domainStr, msgStr, uid, meta);
      this.output(log);
    }
  }

  warn(event: string | Record<string, unknown>, domain?: string, message?: string, userId?: string, metadata?: LogMetadata): void {
    const eventStr = typeof event === 'object' ? String((event as Record<string, unknown>).event || '') : (event as string);
    const domainStr = typeof event === 'object' ? String((event as Record<string, unknown>).context || '') : (domain || 'app');
    const msgStr = typeof event === 'object' ? String((event as Record<string, unknown>).data || '') : (message || eventStr || '');
    const uid = typeof event === 'object' ? (event as Record<string, unknown>).user_id as string | undefined : userId;
    const meta = typeof event === 'object' ? (event as Record<string, unknown>).data as LogMetadata | undefined : metadata;
    
    if (this.shouldLog(LogLevel.WARN)) {
      const log = this.formatLog(LogLevel.WARN, eventStr || 'unknown', domainStr, msgStr, uid, meta);
      this.output(log);
    }
  }

  error(event: string | Record<string, unknown>, domain?: string, message?: string, userId?: string, metadata?: LogMetadata): void {
    const eventStr = typeof event === 'object' ? String((event as Record<string, unknown>).event || '') : (event as string);
    const domainStr = typeof event === 'object' ? String((event as Record<string, unknown>).context || '') : (domain || 'app');
    const msgStr = typeof event === 'object' ? String((event as Record<string, unknown>).data || '') : (message || eventStr || '');
    const uid = typeof event === 'object' ? (event as Record<string, unknown>).user_id as string | undefined : userId;
    const meta = typeof event === 'object' ? (event as Record<string, unknown>).data as LogMetadata | undefined : metadata;
    
    if (this.shouldLog(LogLevel.ERROR)) {
      const log = this.formatLog(LogLevel.ERROR, eventStr || 'unknown', domainStr, msgStr, uid, meta);
      this.output(log);
    }
  }

  // Convenience methods for specific domains
  validation(event: string, message: string, userId?: string, metadata?: LogMetadata): void {
    this.info(event, 'validation', message, userId, metadata);
  }

  fraud(event: string, message: string, userId?: string, metadata?: LogMetadata): void {
    this.warn(event, 'fraud', message, userId, metadata);
  }

  rewards(event: string, message: string, userId?: string, metadata?: LogMetadata): void {
    this.info(event, 'rewards', message, userId, metadata);
  }

  raffles(event: string, message: string, userId?: string, metadata?: LogMetadata): void {
    this.info(event, 'raffles', message, userId, metadata);
  }

  payments(event: string, message: string, userId?: string, metadata?: LogMetadata): void {
    this.info(event, 'payments', message, userId, metadata);
  }
}

export const logger = Logger.getInstance();

// Alert conditions (log-based monitoring)
export class AlertMonitor {
  private static instance: AlertMonitor;
  
  // Track rolling metrics for alert conditions
  private approvalAttempts: number = 0;
  private approvals: number = 0;
  private rewardGrants: number = 0;
  private fraudSignals: number = 0;
  private windowStart: number = Date.now();
  
  private readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour window

  private constructor() {}

  static getInstance(): AlertMonitor {
    if (!AlertMonitor.instance) {
      AlertMonitor.instance = new AlertMonitor();
    }
    return AlertMonitor.instance;
  }

  private resetIfNeeded(): void {
    if (Date.now() - this.windowStart > this.WINDOW_MS) {
      this.approvalAttempts = 0;
      this.approvals = 0;
      this.rewardGrants = 0;
      this.fraudSignals = 0;
      this.windowStart = Date.now();
    }
  }

  recordApprovalAttempt(): void {
    this.resetIfNeeded();
    this.approvalAttempts++;
    this.checkAbnormalApprovalRate();
  }

  recordApproved(): void {
    this.resetIfNeeded();
    this.approvals++;
  }

  recordRewardGranted(): void {
    this.resetIfNeeded();
    this.rewardGrants++;
    this.checkExcessiveRewards();
  }

  recordFraudSignal(): void {
    this.resetIfNeeded();
    this.fraudSignals++;
    this.checkHighFraudSignalFrequency();
  }

  private checkAbnormalApprovalRate(): void {
    if (this.approvalAttempts >= 20) {
      const rate = this.approvals / this.approvalAttempts;
      if (rate > 0.95) {
        logger.warn(
          'abnormal_approval_rate',
          'monitoring',
          `Abnormal approval rate detected: ${(rate * 100).toFixed(1)}% (${this.approvals}/${this.approvalAttempts})`,
          undefined,
          { rate, approvals: this.approvals, attempts: this.approvalAttempts }
        );
      }
    }
  }

  private checkExcessiveRewards(): void {
    if (this.rewardGrants > 50) {
      logger.warn(
        'excessive_rewards',
        'monitoring',
        `Excessive reward generation detected: ${this.rewardGrants} in the last hour`,
        undefined,
        { count: this.rewardGrants }
      );
    }
  }

  private checkHighFraudSignalFrequency(): void {
    if (this.fraudSignals > 30) {
      logger.warn(
        'high_fraud_signals',
        'monitoring',
        `High fraud signal frequency: ${this.fraudSignals} in the last hour`,
        undefined,
        { count: this.fraudSignals }
      );
    }
  }
}

export const alertMonitor = AlertMonitor.getInstance();