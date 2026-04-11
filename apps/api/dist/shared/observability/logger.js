"use strict";
/**
 * Structured Logging Utility
 * Standardizes logs across the system with consistent format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertMonitor = exports.AlertMonitor = exports.logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.minLevel = LogLevel.INFO;
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLevel(level) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const minIdx = levels.indexOf(this.minLevel);
        const newIdx = levels.indexOf(level);
        if (newIdx >= 0) {
            this.minLevel = level;
        }
    }
    shouldLog(level) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentIdx = levels.indexOf(this.minLevel);
        const messageIdx = levels.indexOf(level);
        return messageIdx >= currentIdx;
    }
    formatLog(level, event, domain, message, userId, metadata) {
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
    output(log) {
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
    debug(event, domain, message, userId, metadata) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const log = this.formatLog(LogLevel.DEBUG, event, domain, message, userId, metadata);
            this.output(log);
        }
    }
    info(event, domain, message, userId, metadata) {
        if (this.shouldLog(LogLevel.INFO)) {
            const log = this.formatLog(LogLevel.INFO, event, domain, message, userId, metadata);
            this.output(log);
        }
    }
    warn(event, domain, message, userId, metadata) {
        if (this.shouldLog(LogLevel.WARN)) {
            const log = this.formatLog(LogLevel.WARN, event, domain, message, userId, metadata);
            this.output(log);
        }
    }
    error(event, domain, message, userId, metadata) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const log = this.formatLog(LogLevel.ERROR, event, domain, message, userId, metadata);
            this.output(log);
        }
    }
    // Convenience methods for specific domains
    validation(event, message, userId, metadata) {
        this.info(event, 'validation', message, userId, metadata);
    }
    fraud(event, message, userId, metadata) {
        this.warn(event, 'fraud', message, userId, metadata);
    }
    rewards(event, message, userId, metadata) {
        this.info(event, 'rewards', message, userId, metadata);
    }
    raffles(event, message, userId, metadata) {
        this.info(event, 'raffles', message, userId, metadata);
    }
    payments(event, message, userId, metadata) {
        this.info(event, 'payments', message, userId, metadata);
    }
}
exports.logger = Logger.getInstance();
// Alert conditions (log-based monitoring)
class AlertMonitor {
    constructor() {
        // Track rolling metrics for alert conditions
        this.approvalAttempts = 0;
        this.approvals = 0;
        this.rewardGrants = 0;
        this.fraudSignals = 0;
        this.windowStart = Date.now();
        this.WINDOW_MS = 60 * 60 * 1000; // 1 hour window
    }
    static getInstance() {
        if (!AlertMonitor.instance) {
            AlertMonitor.instance = new AlertMonitor();
        }
        return AlertMonitor.instance;
    }
    resetIfNeeded() {
        if (Date.now() - this.windowStart > this.WINDOW_MS) {
            this.approvalAttempts = 0;
            this.approvals = 0;
            this.rewardGrants = 0;
            this.fraudSignals = 0;
            this.windowStart = Date.now();
        }
    }
    recordApprovalAttempt() {
        this.resetIfNeeded();
        this.approvalAttempts++;
        this.checkAbnormalApprovalRate();
    }
    recordApproved() {
        this.resetIfNeeded();
        this.approvals++;
    }
    recordRewardGranted() {
        this.resetIfNeeded();
        this.rewardGrants++;
        this.checkExcessiveRewards();
    }
    recordFraudSignal() {
        this.resetIfNeeded();
        this.fraudSignals++;
        this.checkHighFraudSignalFrequency();
    }
    checkAbnormalApprovalRate() {
        if (this.approvalAttempts >= 20) {
            const rate = this.approvals / this.approvalAttempts;
            if (rate > 0.95) {
                exports.logger.warn('abnormal_approval_rate', 'monitoring', `Abnormal approval rate detected: ${(rate * 100).toFixed(1)}% (${this.approvals}/${this.approvalAttempts})`, undefined, { rate, approvals: this.approvals, attempts: this.approvalAttempts });
            }
        }
    }
    checkExcessiveRewards() {
        if (this.rewardGrants > 50) {
            exports.logger.warn('excessive_rewards', 'monitoring', `Excessive reward generation detected: ${this.rewardGrants} in the last hour`, undefined, { count: this.rewardGrants });
        }
    }
    checkHighFraudSignalFrequency() {
        if (this.fraudSignals > 30) {
            exports.logger.warn('high_fraud_signals', 'monitoring', `High fraud signal frequency: ${this.fraudSignals} in the last hour`, undefined, { count: this.fraudSignals });
        }
    }
}
exports.AlertMonitor = AlertMonitor;
exports.alertMonitor = AlertMonitor.getInstance();
//# sourceMappingURL=logger.js.map