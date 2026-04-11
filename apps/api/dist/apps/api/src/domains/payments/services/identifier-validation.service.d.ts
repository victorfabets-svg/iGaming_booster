export interface IdentifierValidationResult {
    is_valid: boolean;
    confidence: number;
    format: string;
    issues: string[];
}
export declare function validateIdentifier(type: string, value: string): IdentifierValidationResult;
/**
 * Validate multiple identifiers and return aggregated result
 */
export declare function validateIdentifiers(identifiers: {
    type: string;
    value: string;
    confidence: number;
}[]): {
    valid_count: number;
    invalid_count: number;
    total_confidence: number;
    has_valid_identifiers: boolean;
};
//# sourceMappingURL=identifier-validation.service.d.ts.map