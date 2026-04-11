"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWithHeuristics = validateWithHeuristics;
/**
 * Heuristic Validation Service
 * Validates OCR output for required fields and basic consistency
 */
function validateWithHeuristics(ocrResult) {
    const issues = [];
    // Check required fields
    if (!ocrResult.amount || ocrResult.amount <= 0) {
        issues.push('Amount must be greater than 0');
    }
    if (!ocrResult.date) {
        issues.push('Date is required');
    }
    else {
        // Validate date format and basic consistency
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(ocrResult.date)) {
            issues.push('Date must be in YYYY-MM-DD format');
        }
        else {
            const parsedDate = new Date(ocrResult.date);
            const now = new Date();
            if (isNaN(parsedDate.getTime())) {
                issues.push('Invalid date value');
            }
            else if (parsedDate > now) {
                issues.push('Date cannot be in the future');
            }
        }
    }
    if (!ocrResult.institution || ocrResult.institution.trim() === '') {
        issues.push('Institution is required');
    }
    // Check amount is within reasonable range
    if (ocrResult.amount > 100000) {
        issues.push('Amount exceeds maximum allowed value');
    }
    return {
        is_valid: issues.length === 0,
        issues,
    };
}
//# sourceMappingURL=heuristic.service.js.map