/**
 * Payment Identifier Matcher Service
 * Matches OCR results to partner houses based on extracted data.
 */

import { OcrResult } from './providers/ocr-provider.interface';
import {
  findActiveByCountry,
  PartnerHouse,
} from '../repositories/partner-houses.repository';
import { logger } from '@shared/observability/logger';

export interface HouseMatch {
  house_slug: string;
  confidence: number;
}

const ACCENT_MAP: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ä: 'a',
  ã: 'a',
  å: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ñ: 'n',
  ç: 'c',
};

/**
 * Normalize text for matching (lowercase + remove accents).
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((char) => ACCENT_MAP[char] || char)
    .join('');
}

/**
 * Check if amount is within house's range.
 */
function isAmountInRange(
  amount: number | null,
  minAmount: number | null,
  maxAmount: number | null
): boolean {
  if (amount === null) return false;
  if (minAmount !== null && amount < minAmount) return false;
  if (maxAmount !== null && amount > maxAmount) return false;
  return true;
}

/**
 * Match OCR result to a partner house based on country and extracted data.
 * 
 * Checks:
 * 1. Active houses in the specified country
 * 2. OCR aliases in raw_text
 * 3. Deposit keywords in raw_text
 * 4. Amount within house's min/max range
 * 
 * @param ocr - The OCR result with extracted data
 * @param country - The country code to filter houses
 * @returns Match with house_slug and confidence, or null if no match
 */
export async function matchHouseFromOcr(
  ocr: OcrResult,
  country: string
): Promise<HouseMatch | null> {
  // If OCR is not successful, no match
  if (ocr.status !== 'success' || !ocr.raw_text) {
    return null;
  }

  // Get active houses for the country
  const houses = await findActiveByCountry(country);

  if (houses.length === 0) {
    logger.info({
      event: 'no_houses_for_country',
      context: 'validation',
      data: { country },
    });
    return null;
  }

  const normalizedText = normalizeText(ocr.raw_text);
  let bestMatch: { house: PartnerHouse; confidence: number } | null = null;

  for (const house of houses) {
    let confidence = 0;

    // Check OCR aliases (highest weight)
    for (const alias of house.ocr_aliases) {
      const normalizedAlias = normalizeText(alias);
      if (normalizedText.includes(normalizedAlias)) {
        confidence = Math.max(confidence, 0.7);
        break;
      }
    }

    // Check deposit keywords (lower weight)
    for (const keyword of house.deposit_keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedText.includes(normalizedKeyword)) {
        confidence = Math.max(confidence, 0.4);
        break;
      }
    }

    // FIX-16: Check regex patterns (configurable weight)
    for (const pattern of (house.regex_patterns || [])) {
      try {
        const re = new RegExp(pattern.regex, pattern.flags || 'i');
        if (re.test(ocr.raw_text)) {
          confidence = Math.max(confidence, pattern.weight || 0.5);
          break;
        }
      } catch (e) {
        // Invalid regex - skip to avoid crash
        logger.warn({
          event: 'invalid_regex_pattern',
          context: 'validation',
          data: { house: house.slug, pattern: pattern.regex, error: String(e) },
        });
      }
    }

    // Check amount range (if we have amount)
    if (ocr.amount !== null && isAmountInRange(ocr.amount, house.min_amount, house.max_amount)) {
      confidence = Math.max(confidence, 0.3);
    }

    // Update best match if confidence is higher
    if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { house, confidence };
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    house_slug: bestMatch.house.slug,
    confidence: bestMatch.confidence,
  };
}