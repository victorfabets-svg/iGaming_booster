"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIdentifier = validateIdentifier;
exports.validateIdentifiers = validateIdentifiers;
// PIX End-to-End ID format: 32 alphanumeric characters
const PIX_E2E_PATTERN = /^[A-Z0-9]{32}$/;
// Transaction reference format: alphanumeric, 8-16 characters
const TRANSACTION_REF_PATTERN = /^[A-Z0-9-]{8,16}$/;
// Boleto barcode: 48 digits
const BOLETO_PATTERN = /^\d{48}$/;
// Payment reference: alphanumeric with dash, 8-20 characters
const PAYMENT_REF_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4,16}$/;
function validateIdentifier(type, value) {
    const issues = [];
    switch (type) {
        case 'pix_end_to_end':
            return validatePixE2E(value);
        case 'transaction_reference':
            return validateTransactionReference(value);
        case 'boleto_barcode':
            return validateBoleto(value);
        case 'payment_reference':
            return validatePaymentReference(value);
        default:
            return {
                is_valid: false,
                confidence: 0,
                format: 'unknown',
                issues: [`Unknown identifier type: ${type}`],
            };
    }
}
function validatePixE2E(value) {
    const issues = [];
    let confidence = 0.9;
    if (value.length !== 32) {
        issues.push('PIX E2E ID must be exactly 32 characters');
        confidence -= 0.4;
    }
    if (!PIX_E2E_PATTERN.test(value)) {
        issues.push('PIX E2E ID must contain only uppercase letters and numbers');
        confidence -= 0.3;
    }
    // Check for suspicious patterns (all same character, sequential, etc.)
    const uniqueChars = new Set(value.split('')).size;
    if (uniqueChars < 10) {
        issues.push('PIX E2E ID has low entropy (suspicious)');
        confidence -= 0.2;
    }
    // Check first character is not a common pattern
    const firstChar = value[0];
    if (value.split('').every(c => c === firstChar)) {
        issues.push('PIX E2E ID has all same characters (invalid)');
        confidence -= 0.3;
    }
    return {
        is_valid: issues.length === 0,
        confidence: Math.max(0, confidence),
        format: 'pix_end_to_end',
        issues,
    };
}
function validateTransactionReference(value) {
    const issues = [];
    let confidence = 0.85;
    if (value.length < 8 || value.length > 16) {
        issues.push('Transaction reference must be 8-16 characters');
        confidence -= 0.3;
    }
    if (!TRANSACTION_REF_PATTERN.test(value)) {
        issues.push('Transaction reference must be alphanumeric with optional dashes');
        confidence -= 0.25;
    }
    return {
        is_valid: issues.length === 0,
        confidence: Math.max(0, confidence),
        format: 'transaction_reference',
        issues,
    };
}
function validateBoleto(value) {
    const issues = [];
    let confidence = 0.8;
    if (value.length !== 48) {
        issues.push('Boleto barcode must be exactly 48 digits');
        confidence -= 0.4;
    }
    if (!BOLETO_PATTERN.test(value)) {
        issues.push('Boleto barcode must contain only digits');
        confidence -= 0.3;
    }
    // Validate check digit (Mod10 check for first 47 digits)
    // This is a simplified check - real validation would be more complex
    if (value.length === 48) {
        let sum = 0;
        let multiplier = 2;
        for (let i = 46; i >= 0; i--) {
            const digit = parseInt(value[i], 10);
            const result = digit * multiplier;
            sum += result > 9 ? (result % 10) + 1 : result;
            multiplier = multiplier === 2 ? 1 : 2;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        if (checkDigit !== parseInt(value[47], 10)) {
            issues.push('Boleto barcode check digit invalid');
            confidence -= 0.2;
        }
    }
    return {
        is_valid: issues.length === 0,
        confidence: Math.max(0, confidence),
        format: 'boleto_barcode',
        issues,
    };
}
function validatePaymentReference(value) {
    const issues = [];
    let confidence = 0.85;
    if (!PAYMENT_REF_PATTERN.test(value)) {
        issues.push('Payment reference must be in format: PAY-XXXXXXXX (8-20 chars after dash)');
        confidence -= 0.3;
    }
    const parts = value.split('-');
    if (parts.length !== 2 || parts[0] !== 'PAY') {
        issues.push('Payment reference must start with "PAY-"');
        confidence -= 0.2;
    }
    return {
        is_valid: issues.length === 0,
        confidence: Math.max(0, confidence),
        format: 'payment_reference',
        issues,
    };
}
/**
 * Validate multiple identifiers and return aggregated result
 */
function validateIdentifiers(identifiers) {
    let validCount = 0;
    let invalidCount = 0;
    let totalConfidence = 0;
    for (const identifier of identifiers) {
        const result = validateIdentifier(identifier.type, identifier.value);
        if (result.is_valid) {
            validCount++;
            totalConfidence += result.confidence;
        }
        else {
            invalidCount++;
        }
    }
    return {
        valid_count: validCount,
        invalid_count: invalidCount,
        total_confidence: validCount > 0 ? totalConfidence / validCount : 0,
        has_valid_identifiers: validCount > 0,
    };
}
//# sourceMappingURL=identifier-validation.service.js.map