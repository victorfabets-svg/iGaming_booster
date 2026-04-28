/**
 * Partner Houses Repository
 * Manages partner house data for OCR-based payment identifier matching.
 */

import { db } from '@shared/database/connection';
import { randomUUID } from 'crypto';

export interface PartnerHouse {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  ocr_aliases: string[];
  deposit_keywords: string[];
  min_amount: number | null;
  max_amount: number | null;
  regex_patterns: any[];
  active: boolean;
  created_at: Date;
  updated_at: Date;
  tickets_per_deposit: number;
  min_amount_per_ticket_cents: number | null;
}

export interface PartnerHouseInput {
  slug: string;
  name: string;
  country: string;
  currency: string;
  ocr_aliases?: string[];
  deposit_keywords?: string[];
  min_amount?: number | null;
  max_amount?: number | null;
  regex_patterns?: any[];
  active?: boolean;
}

/**
 * Find active partner houses by country.
 */
export async function findActiveByCountry(country: string): Promise<PartnerHouse[]> {
  const result = await db.query<PartnerHouse>(
    `SELECT id, slug, name, country, currency, ocr_aliases, deposit_keywords, 
            min_amount, max_amount, regex_patterns, active, created_at, updated_at
     FROM validation.partner_houses 
     WHERE country = $1 AND active = true`,
    [country.toUpperCase()]
  );
  return result.rows;
}

/**
 * Find a partner house by ID.
 */
export async function findById(id: string): Promise<PartnerHouse | null> {
  const result = await db.query<PartnerHouse>(
    `SELECT id, slug, name, country, currency, ocr_aliases, deposit_keywords, 
            min_amount, max_amount, regex_patterns, active, created_at, updated_at
     FROM validation.partner_houses 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find a partner house by slug.
 */
export async function findBySlug(slug: string): Promise<PartnerHouse | null> {
  const result = await db.query<PartnerHouse>(
    `SELECT id, slug, name, country, currency, ocr_aliases, deposit_keywords, 
            min_amount, max_amount, regex_patterns, active, created_at, updated_at
     FROM validation.partner_houses 
     WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * List all partner houses.
 */
export async function listAll(): Promise<PartnerHouse[]> {
  const result = await db.query<PartnerHouse>(
    `SELECT id, slug, name, country, currency, ocr_aliases, deposit_keywords, 
            min_amount, max_amount, regex_patterns, active, created_at, updated_at
     FROM validation.partner_houses 
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Upsert a partner house by slug (idempotent).
 * Creates if not exists, updates if exists.
 */
export async function upsertBySlug(input: PartnerHouseInput): Promise<PartnerHouse> {
  const now = new Date();
  const slug = input.slug.toLowerCase();
  const country = input.country.toUpperCase();
  const currency = input.currency.toUpperCase();
  const ocrAliases = input.ocr_aliases || [];
  const depositKeywords = input.deposit_keywords || [];
  const minAmount = input.min_amount ?? null;
  const maxAmount = input.max_amount ?? null;
  const regexPatterns = input.regex_patterns || [];
  const active = input.active !== undefined ? input.active : true;

  const result = await db.query<PartnerHouse>(
    `INSERT INTO validation.partner_houses 
     (id, slug, name, country, currency, ocr_aliases, deposit_keywords, 
      min_amount, max_amount, regex_patterns, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       country = EXCLUDED.country,
       currency = EXCLUDED.currency,
       ocr_aliases = EXCLUDED.ocr_aliases,
       deposit_keywords = EXCLUDED.deposit_keywords,
       min_amount = EXCLUDED.min_amount,
       max_amount = EXCLUDED.max_amount,
       regex_patterns = EXCLUDED.regex_patterns,
       active = EXCLUDED.active,
       updated_at = EXCLUDED.updated_at
     RETURNING id, slug, name, country, currency, ocr_aliases, deposit_keywords, 
              min_amount, max_amount, regex_patterns, active, created_at, updated_at`,
    [
      randomUUID(),
      slug,
      input.name,
      country,
      currency,
      ocrAliases,
      depositKeywords,
      minAmount,
      maxAmount,
      JSON.stringify(regexPatterns),
      active,
      now,
      now,
    ]
  );

  return result.rows[0];
}

/**
 * Deactivate a partner house (soft delete).
 */
export async function deactivateById(id: string): Promise<void> {
  await db.query(
    `UPDATE validation.partner_houses 
     SET active = false, updated_at = NOW() 
     WHERE id = $1`,
    [id]
  );
}