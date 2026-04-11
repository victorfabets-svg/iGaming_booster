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
exports.extractTextFromImage = extractTextFromImage;
const crypto = __importStar(require("crypto"));
/**
 * Mock OCR Service
 * Returns deterministic mock data based on file_url hash
 */
function extractTextFromImage(fileUrl) {
    // Generate deterministic data from file_url
    const hash = crypto.createHash('sha256').update(fileUrl).digest();
    // Extract deterministic values from hash
    const amountBase = hash.readUInt16BE(0) % 10000; // 0-9999
    const day = (hash.readUInt8(2) % 28) + 1; // 1-28
    const month = (hash.readUInt8(3) % 12) + 1; // 1-12
    const year = 2024 + (hash.readUInt8(4) % 3); // 2024-2026
    const institutions = ['Bank of America', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One'];
    const institutionIndex = hash.readUInt8(5) % institutions.length;
    const hasIdentifier = hash.readUInt8(6) % 2 === 1;
    const identifierBase = hash.readUInt32BE(7);
    return {
        amount: amountBase > 0 ? amountBase / 100 : 10.00, // Convert to decimal, min 0.10
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        institution: institutions[institutionIndex],
        identifier: hasIdentifier ? `TXN-${identifierBase.toString(16).slice(0, 8).toUpperCase()}` : null,
    };
}
//# sourceMappingURL=ocr.service.js.map