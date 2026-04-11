export interface ExtractedIdentifier {
    type: string;
    value: string;
    confidence: number;
    source: string;
}
/**
 * Identifier Extraction Service
 * Extracts payment identifiers from OCR output (mock implementation)
 * In production, this would analyze the OCR text to find identifiers like PIX E2E IDs
 */
export declare function extractIdentifiers(ocrResult: {
    amount: number;
    date: string;
    institution: string;
    identifier: string | null;
}): ExtractedIdentifier[];
/**
 * Get all identifier types that the service can extract
 */
export declare function getSupportedIdentifierTypes(): string[];
//# sourceMappingURL=identifier.service.d.ts.map