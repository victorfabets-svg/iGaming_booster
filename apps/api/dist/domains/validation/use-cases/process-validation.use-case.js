"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processValidation = processValidation;
const proof_repository_1 = require("../../validation/repositories/proof.repository");
const proof_validation_repository_1 = require("../../validation/repositories/proof-validation.repository");
const fraud_score_repository_1 = require("../../fraud/repositories/fraud-score.repository");
const ocr_service_1 = require("../../validation/services/ocr.service");
const heuristic_service_1 = require("../../validation/services/heuristic.service");
const fraud_score_service_1 = require("../../fraud/services/fraud-score.service");
const event_repository_1 = require("../../../shared/events/event.repository");
const payment_signal_repository_1 = require("../../payments/repositories/payment-signal.repository");
const identifier_service_1 = require("../../payments/services/identifier.service");
const identifier_validation_service_1 = require("../../payments/services/identifier-validation.service");
const logger_1 = require("../../../shared/observability/logger");
const metrics_service_1 = require("../../../shared/observability/metrics.service");
const feature_flags_1 = require("../../../shared/config/feature-flags");
const env_1 = require("../../../shared/config/env");
async function processValidation(input) {
    const { proof_id, risk_score_modifier = 0 } = input;
    // Check if validation is enabled
    if (!(0, feature_flags_1.isValidationEnabled)()) {
        logger_1.logger.warn('validation_disabled', 'validation', 'Validation is currently disabled', undefined, { proof_id });
        throw new Error('Validation is currently disabled');
    }
    // Use config for thresholds if automatic approval is enabled
    const useConfigThresholds = (0, feature_flags_1.isAutomaticApprovalEnabled)();
    const approvalThreshold = useConfigThresholds ? env_1.config.validation.approvalThreshold : 0.9;
    const manualReviewThreshold = useConfigThresholds ? env_1.config.validation.manualReviewThreshold : 0.6;
    console.log(`🔄 Processing validation for proof: ${proof_id}`);
    // Load proof from database
    const proof = await (0, proof_repository_1.findProofById)(proof_id);
    if (!proof) {
        throw new Error(`Proof not found: ${proof_id}`);
    }
    console.log(`📄 Loaded proof: file_url = ${proof.file_url}`);
    logger_1.alertMonitor.recordApprovalAttempt();
    logger_1.logger.info('validation_started', 'validation', `Starting validation for proof: ${proof_id}`, proof.user_id, { proof_id, risk_modifier: risk_score_modifier });
    // Step 1: Run OCR (mock)
    console.log(`🔍 Running OCR...`);
    const ocrResult = (0, ocr_service_1.extractTextFromImage)(proof.file_url);
    console.log(`   Amount: ${ocrResult.amount}, Date: ${ocrResult.date}, Institution: ${ocrResult.institution}`);
    // Step 2: Extract payment identifiers
    console.log(`💳 Extracting payment identifiers...`);
    const extractedIdentifiers = (0, identifier_service_1.extractIdentifiers)(ocrResult);
    console.log(`   Found ${extractedIdentifiers.length} identifiers`);
    // Validate identifiers
    const validationResult = (0, identifier_validation_service_1.validateIdentifiers)(extractedIdentifiers);
    console.log(`   Valid: ${validationResult.valid_count}, Invalid: ${validationResult.invalid_count}`);
    console.log(`   Has valid identifiers: ${validationResult.has_valid_identifiers}`);
    // Persist payment signals
    console.log(`💾 Persisting payment signals...`);
    for (const identifier of extractedIdentifiers) {
        const validation = (0, identifier_validation_service_1.validateIdentifier)(identifier.type, identifier.value);
        await (0, payment_signal_repository_1.createPaymentSignal)({
            proof_id: proof_id,
            type: identifier.type,
            value: identifier.value,
            confidence: validation.confidence,
            metadata: {
                source: identifier.source,
                is_valid: validation.is_valid,
                issues: validation.issues,
            },
        });
    }
    // Emit payment_identifier_extracted event
    await (0, event_repository_1.createEvent)({
        event_type: 'payment_identifier_extracted',
        version: 'v1',
        payload: {
            proof_id: proof_id,
            identifiers: extractedIdentifiers.map(i => ({ type: i.type, value: i.value, confidence: i.confidence })),
            validation: validationResult,
        },
        producer: 'validation',
    });
    // Emit payment_signal_detected if we have valid identifiers
    if (validationResult.has_valid_identifiers) {
        await (0, event_repository_1.createEvent)({
            event_type: 'payment_signal_detected',
            version: 'v1',
            payload: {
                proof_id: proof_id,
                signal_type: 'valid_payment_identifiers',
                count: validationResult.valid_count,
                confidence: validationResult.total_confidence,
            },
            producer: 'validation',
        });
    }
    // Calculate payment signal confidence modifier
    const paymentModifier = validationResult.has_valid_identifiers
        ? validationResult.total_confidence * 0.15 // Up to +0.15 for valid identifiers
        : -0.1; // -0.1 for missing identifiers
    // Step 3: Run heuristic validation
    console.log(`⚙️  Running heuristic validation...`);
    const heuristicResult = (0, heuristic_service_1.validateWithHeuristics)(ocrResult);
    console.log(`   Valid: ${heuristicResult.is_valid}, Issues: ${heuristicResult.issues.length}`);
    // Step 4: Generate fraud score (with risk + payment modifiers)
    console.log(`🛡️  Calculating fraud score...`);
    const fraudScoreResult = (0, fraud_score_service_1.calculateFraudScore)(ocrResult, heuristicResult, risk_score_modifier, paymentModifier);
    console.log(`   Score: ${fraudScoreResult.score} (risk: ${risk_score_modifier}, payment: ${paymentModifier})`);
    // Step 4: Persist fraud score
    console.log(`💾 Persisting fraud score...`);
    await (0, fraud_score_repository_1.createFraudScore)({
        proof_id: proof_id,
        score: fraudScoreResult.score,
        signals: fraudScoreResult.signals,
    });
    // Step 5: Determine decision
    let decision;
    if (fraudScoreResult.score >= approvalThreshold) {
        decision = 'approved';
        logger_1.alertMonitor.recordApproved();
    }
    else if (fraudScoreResult.score >= manualReviewThreshold) {
        decision = 'manual_review';
    }
    else {
        decision = 'rejected';
    }
    console.log(`📊 Decision: ${decision} (confidence: ${fraudScoreResult.score}, thresholds: ${approvalThreshold}/${manualReviewThreshold})`);
    // Log validation result
    logger_1.logger.info('validation_completed', 'validation', `Validation completed: ${decision}`, proof.user_id, {
        proof_id,
        decision,
        confidence: fraudScoreResult.score,
        signals: fraudScoreResult.signals
    });
    // Record metrics
    (0, metrics_service_1.recordValidationResult)(decision);
    // Step 6: Update validation record
    const validation = await (0, proof_validation_repository_1.findValidationByProofId)(proof_id);
    if (!validation) {
        throw new Error(`Validation not found for proof: ${proof_id}`);
    }
    await (0, proof_validation_repository_1.updateValidationStatus)(validation.id, decision, fraudScoreResult.score);
    console.log(`✅ Validation record updated: status = ${decision}, confidence_score = ${fraudScoreResult.score}`);
    // Emit proof_validated event
    await (0, event_repository_1.createEvent)({
        event_type: 'proof_validated',
        version: 'v1',
        payload: {
            proof_id: proof_id,
            user_id: proof.user_id,
            file_url: proof.file_url,
            submitted_at: proof.submitted_at,
            validation_id: validation.id,
            status: decision,
            confidence_score: fraudScoreResult.score,
        },
        producer: 'validation',
    });
    console.log(`📢 Emitted proof_validated event`);
    return {
        validation_id: validation.id,
        proof_id: proof_id,
        decision: decision,
        confidence_score: fraudScoreResult.score,
        ocr_result: ocrResult,
        heuristic_result: heuristicResult,
    };
}
//# sourceMappingURL=process-validation.use-case.js.map