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
exports.submitProof = submitProof;
const crypto = __importStar(require("crypto"));
const proof_repository_1 = require("../repositories/proof.repository");
const event_repository_1 = require("../../../../../../shared/events/event.repository");
const rate_limit_service_1 = require("../../fraud/services/rate-limit.service");
const behavior_service_1 = require("../../fraud/services/behavior.service");
const logger_1 = require("../../../../../../shared/observability/logger");
const metrics_service_1 = require("../../../../../../shared/observability/metrics.service");
function generateHash(fileUrl) {
    return crypto.createHash('sha256').update(fileUrl).digest('hex');
}
async function submitProof(input) {
    // Validate input
    if (!input.user_id || typeof input.user_id !== 'string') {
        throw new Error('user_id is required');
    }
    if (!input.file_url || typeof input.file_url !== 'string') {
        throw new Error('file_url is required');
    }
    // Check rate limit before submission
    const rateLimitCheck = await rate_limit_service_1.rateLimitService.checkProofSubmissionLimit(input.user_id);
    if (!rateLimitCheck.allowed) {
        (0, metrics_service_1.recordProofSubmission)('rate_limited');
        logger_1.logger.warn('rate_limit_exceeded', 'validation', rateLimitCheck.reason || 'Rate limit exceeded', input.user_id);
        // Emit rate_limit_exceeded event
        await (0, event_repository_1.createEvent)({
            event_type: 'rate_limit_exceeded',
            version: 'v1',
            payload: {
                user_id: input.user_id,
                limit_type: 'proofs_per_hour',
                reason: rateLimitCheck.reason,
            },
            producer: 'validation',
        });
        throw new Error(rateLimitCheck.reason);
    }
    // Generate hash from file_url
    const hash = generateHash(input.file_url);
    // Check if proof already exists (idempotency)
    const existingProof = await (0, proof_repository_1.findProofByHash)(hash);
    if (existingProof) {
        logger_1.logger.info('proof_duplicate', 'validation', 'Proof already exists, returning existing', input.user_id, { proof_id: existingProof.id });
        return { proof_id: existingProof.id };
    }
    // Perform behavior analysis
    const behaviorCheck = await behavior_service_1.behaviorAnalysisService.analyzeBehavior(input.user_id);
    if (behaviorCheck.is_suspicious) {
        logger_1.logger.fraud('fraud_flag_detected', 'Suspicious behavior detected', input.user_id, { signals: behaviorCheck.signals });
        // Emit fraud_flag_detected event
        await (0, event_repository_1.createEvent)({
            event_type: 'fraud_flag_detected',
            version: 'v1',
            payload: {
                user_id: input.user_id,
                file_url: input.file_url,
                signals: behaviorCheck.signals,
                risk_score_modifier: behaviorCheck.risk_score_modifier,
            },
            producer: 'validation',
        });
    }
    // Create proof input
    const proofInput = {
        user_id: input.user_id,
        file_url: input.file_url,
        hash: hash,
    };
    // Persist proof first (before emitting event)
    const proof = await (0, proof_repository_1.createProof)(proofInput);
    logger_1.logger.info('proof_created', 'validation', 'Proof created successfully', input.user_id, { proof_id: proof.id });
    // Record rate limit after successful submission
    await rate_limit_service_1.rateLimitService.recordProofSubmission(input.user_id);
    // Emit proof_submitted event
    await (0, event_repository_1.createEvent)({
        event_type: 'proof_submitted',
        version: 'v1',
        payload: {
            proof_id: proof.id,
            user_id: proof.user_id,
            file_url: proof.file_url,
            submitted_at: proof.submitted_at,
            behavior_signals: behaviorCheck.is_suspicious ? behaviorCheck.signals : null,
        },
        producer: 'validation',
    });
    return { proof_id: proof.id };
}
//# sourceMappingURL=submit-proof.use-case.js.map