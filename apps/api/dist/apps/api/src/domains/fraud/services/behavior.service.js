"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.behaviorAnalysisService = exports.BehaviorAnalysisService = void 0;
const risk_signal_repository_1 = require("../repositories/risk-signal.repository");
class BehaviorAnalysisService {
    constructor() { }
    static getInstance() {
        if (!BehaviorAnalysisService.instance) {
            BehaviorAnalysisService.instance = new BehaviorAnalysisService();
        }
        return BehaviorAnalysisService.instance;
    }
    async analyzeBehavior(userId, currentProofId) {
        const signals = [];
        let riskScoreModifier = 0;
        // Get user's recent proofs (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const userProofs = await this.getUserRecentProofs(userId, oneDayAgo);
        if (userProofs.length === 0) {
            return {
                is_suspicious: false,
                signals: [],
                risk_score_modifier: 0,
            };
        }
        // Signal: Multiple submissions in short period
        if (userProofs.length >= 3) {
            signals.push('multiple_submissions_24h');
            riskScoreModifier += 0.15;
        }
        if (userProofs.length >= 5) {
            signals.push('excessive_submissions_24h');
            riskScoreModifier += 0.25;
        }
        // Signal: Check for repeated file_url (potential duplicate submission)
        const fileUrls = userProofs.map(p => p.file_url);
        const uniqueUrls = new Set(fileUrls);
        if (fileUrls.length > 1 && uniqueUrls.size < fileUrls.length) {
            signals.push('repeated_file_url');
            riskScoreModifier += 0.3;
            await (0, risk_signal_repository_1.createRiskSignal)({
                user_id: userId,
                signal_type: 'repeated_file_url',
                value: fileUrls.join(', '),
                metadata: { proof_ids: userProofs.map(p => p.id), count: fileUrls.length },
            });
        }
        // Signal: Check submission frequency
        if (userProofs.length >= 3) {
            const timestamps = userProofs.map(p => new Date(p.submitted_at).getTime()).sort((a, b) => a - b);
            const avgGap = (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
            const minutesGap = avgGap / (1000 * 60);
            if (minutesGap < 2) {
                signals.push('rapid_submissions');
                riskScoreModifier += 0.2;
            }
        }
        // Signal: Check for risk signals in last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentRiskSignals = await (0, risk_signal_repository_1.countRiskSignalsByUser)(userId, 'rate_limit_exceeded', oneHourAgo);
        if (recentRiskSignals > 0) {
            signals.push('recent_rate_limit_violation');
            riskScoreModifier += 0.1;
        }
        // Signal: Check for fraud flags
        const fraudFlags = await (0, risk_signal_repository_1.countRiskSignalsByUser)(userId, 'fraud_flag_detected');
        if (fraudFlags > 0) {
            signals.push('history_of_fraud_flags');
            riskScoreModifier += 0.2;
        }
        const isSuspicious = signals.length > 0;
        if (isSuspicious) {
            await (0, risk_signal_repository_1.createRiskSignal)({
                user_id: userId,
                signal_type: 'behavior_analysis',
                value: isSuspicious ? 'suspicious' : 'normal',
                metadata: {
                    signals,
                    riskScoreModifier,
                    proof_count_24h: userProofs.length,
                },
            });
        }
        return {
            is_suspicious: isSuspicious,
            signals,
            risk_score_modifier: Math.min(riskScoreModifier, 0.5), // Cap at 0.5
        };
    }
    async getUserRecentProofs(userId, since) {
        const { query } = await Promise.resolve().then(() => __importStar(require('../../../lib/database')));
        const result = await query(`SELECT id, file_url, submitted_at 
       FROM validation.proofs 
       WHERE user_id = $1 AND submitted_at >= $2
       ORDER BY submitted_at DESC`, [userId, since]);
        return result;
    }
    async flagFraudDetection(userId, proofId, reason) {
        await (0, risk_signal_repository_1.createRiskSignal)({
            user_id: userId,
            signal_type: 'fraud_flag_detected',
            value: reason,
            metadata: { proof_id: proofId },
        });
    }
}
exports.BehaviorAnalysisService = BehaviorAnalysisService;
exports.behaviorAnalysisService = BehaviorAnalysisService.getInstance();
//# sourceMappingURL=behavior.service.js.map