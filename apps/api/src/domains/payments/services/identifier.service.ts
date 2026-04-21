import * as crypto from 'crypto';

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
export function extractIdentifiers(ocrResult: {
  amount: number;
  date: string;
  institution: string;
  identifier?: string | null;
}): ExtractedIdentifier[] {
  const identifiers: ExtractedIdentifier[] = [];

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
export function getSupportedIdentifierTypes(): string[] {
  return [
    'pix_end_to_end',
    'transaction_reference',
    'boleto_barcode',
    'payment_reference',
  ];
}