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
exports.extractIdentifiers = extractIdentifiers;
exports.getSupportedIdentifierTypes = getSupportedIdentifierTypes;
const crypto = __importStar(require("crypto"));
/**
 * Identifier Extraction Service
 * Extracts payment identifiers from OCR output (mock implementation)
 * In production, this would analyze the OCR text to find identifiers like PIX E2E IDs
 */
function extractIdentifiers(ocrResult) {
    const identifiers = [];
    // If OCR already found an identifier, use it as a transaction reference
    if (ocrResult.identifier) {
        identifiers.push({
            type: 'transaction_reference',
            value: ocrResult.identifier,
            confidence: 0.85,
            source: 'ocr_identifier',
        });
    }
    // Generate mock PIX end-to-end ID based on deterministic data
    // In production, this would be extracted from OCR text
    const hash = crypto.createHash('sha256')
        .update(`${ocrResult.institution}:${ocrResult.date}:${ocrResult.amount}`)
        .digest();
    // Generate PIX E2E ID (32 characters, alphanumeric)
    const pixE2EId = hash.toString('hex').toUpperCase().slice(0, 32);
    identifiers.push({
        type: 'pix_end_to_end',
        value: pixE2EId,
        confidence: 0.75,
        source: 'mock_extraction',
    });
    // Generate a mock bank slip/boleto barcode
    // In production, this would be extracted from OCR
    const barcodeHash = crypto.createHash('sha256')
        .update(`${ocrResult.amount}:${ocrResult.date}`)
        .digest();
    const barcode = Array.from(barcodeHash)
        .map(b => b.toString(10).padStart(3, '0'))
        .join('')
        .slice(0, 48);
    identifiers.push({
        type: 'boleto_barcode',
        value: barcode,
        confidence: 0.6,
        source: 'mock_extraction',
    });
    // Generate a mock payment method reference
    const paymentRef = `PAY-${hash.toString('hex').slice(0, 16).toUpperCase()}`;
    identifiers.push({
        type: 'payment_reference',
        value: paymentRef,
        confidence: 0.7,
        source: 'mock_extraction',
    });
    return identifiers;
}
/**
 * Get all identifier types that the service can extract
 */
function getSupportedIdentifierTypes() {
    return [
        'pix_end_to_end',
        'transaction_reference',
        'boleto_barcode',
        'payment_reference',
    ];
}
//# sourceMappingURL=identifier.service.js.map