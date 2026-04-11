"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSHA256 = generateSHA256;
const crypto_1 = require("crypto");
/**
 * Generates SHA-256 hash of a buffer
 * @param buffer - The buffer to hash
 * @returns The hex-encoded hash string
 */
function generateSHA256(buffer) {
    return (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
}
//# sourceMappingURL=hash.js.map