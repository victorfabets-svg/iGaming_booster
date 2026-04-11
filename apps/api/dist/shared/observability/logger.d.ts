/**
 * Structured Logging Utility
 * Standardizes logs across the system with consistent format
 */
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
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
declare class Logger {
    private static instance;
    private minLevel;
    private constructor();
    static getInstance(): Logger;
    setLevel(level: LogLevel): void;
    private shouldLog;
    private formatLog;
    private output;
    debug(event: string, domain: string, message: string, userId?: string, metadata?: LogMetadata): void;
    info(event: string, domain: string, message: string, userId?: string, metadata?: LogMetadata): void;
    warn(event: string, domain: string, message: string, userId?: string, metadata?: LogMetadata): void;
    error(event: string, domain: string, message: string, userId?: string, metadata?: LogMetadata): void;
    validation(event: string, message: string, userId?: string, metadata?: LogMetadata): void;
    fraud(event: string, message: string, userId?: string, metadata?: LogMetadata): void;
    rewards(event: string, message: string, userId?: string, metadata?: LogMetadata): void;
    raffles(event: string, message: string, userId?: string, metadata?: LogMetadata): void;
    payments(event: string, message: string, userId?: string, metadata?: LogMetadata): void;
}
export declare const logger: Logger;
export declare class AlertMonitor {
    private static instance;
    private approvalAttempts;
    private approvals;
    private rewardGrants;
    private fraudSignals;
    private windowStart;
    private readonly WINDOW_MS;
    private constructor();
    static getInstance(): AlertMonitor;
    private resetIfNeeded;
    recordApprovalAttempt(): void;
    recordApproved(): void;
    recordRewardGranted(): void;
    recordFraudSignal(): void;
    private checkAbnormalApprovalRate;
    private checkExcessiveRewards;
    private checkHighFraudSignalFrequency;
}
export declare const alertMonitor: AlertMonitor;
export {};
//# sourceMappingURL=logger.d.ts.map