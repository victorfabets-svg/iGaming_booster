import * as crypto from 'crypto';

export interface OcrResult {
  amount: number;
  date: string;
  institution: string;
  identifier: string | null;
}

/**
 * Mock OCR Service
 * Returns deterministic mock data based on file_url hash
 */
export function extractTextFromImage(fileUrl: string): OcrResult {
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