/**
 * Partner Houses Loader Script
 * 
 * Loads partner houses from CSV or JSON files.
 * 
 * Usage:
 *   ts-node -r tsconfig-paths/register scripts/load-partner-houses.ts <path-to-file>
 * 
 * CSV format (required header):
 *   slug,name,country,currency,ocr_aliases,deposit_keywords,min_amount,max_amount
 * 
 * JSON format:
 *   Array of PartnerHouseInput objects
 */

import * as fs from 'fs';
import * as path from 'path';
import { upsertBySlug, PartnerHouseInput } from '../src/domains/validation/repositories/partner-houses.repository';
import { db, connectWithRetry } from '../src/shared/database/connection';

interface CsvRow {
  slug: string;
  name: string;
  country: string;
  currency: string;
  ocr_aliases?: string;
  deposit_keywords?: string;
  min_amount?: string;
  max_amount?: string;
}

/**
 * Parse CSV line handling quoted fields.
 */
function parseCsvLine(line: string): CsvRow {
  const result: Record<string, string> = {} as Record<string, string>;
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  // Map to object
  const headers = ['slug', 'name', 'country', 'currency', 'ocr_aliases', 'deposit_keywords', 'min_amount', 'max_amount'];
  for (let i = 0; i < headers.length && i < values.length; i++) {
    if (values[i]) {
      (result as Record<string, string>)[headers[i]] = values[i];
    }
  }

  return result as unknown as CsvRow;
}

/**
 * Convert CSV row to PartnerHouseInput.
 */
function csvRowToInput(row: CsvRow): PartnerHouseInput {
  return {
    slug: row.slug,
    name: row.name,
    country: row.country.toUpperCase(),
    currency: row.currency.toUpperCase(),
    ocr_aliases: row.ocr_aliases ? row.ocr_aliases.split('|').map((s) => s.trim()).filter(Boolean) : undefined,
    deposit_keywords: row.deposit_keywords ? row.deposit_keywords.split('|').map((s) => s.trim()).filter(Boolean) : undefined,
    min_amount: row.min_amount ? parseFloat(row.min_amount) : undefined,
    max_amount: row.max_amount ? parseFloat(row.max_amount) : undefined,
  };
}

/**
 * Main loader function.
 */
async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: load-partner-houses.ts <path-to-csv-or-json>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Connect to database
  await connectWithRetry();
  console.log('✅ Database connected');

  const ext = path.extname(filePath).toLowerCase();
  let houses: PartnerHouseInput[];

  if (ext === '.json') {
    // JSON format
    const content = fs.readFileSync(filePath, 'utf-8');
    houses = JSON.parse(content);
    if (!Array.isArray(houses)) {
      console.error('JSON file must contain an array of partner houses');
      process.exit(1);
    }
  } else if (ext === '.csv') {
    // CSV format
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      console.error('CSV file must have a header row and at least one data row');
      process.exit(1);
    }

    const header = lines[0].toLowerCase();
    if (!header.includes('slug') || !header.includes('country')) {
      console.error('CSV must have slug and country columns');
      process.exit(1);
    }

    houses = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const row = parseCsvLine(lines[i]);
        if (row.slug && row.country) {
          houses.push(csvRowToInput(row));
        }
      }
    }
  } else {
    console.error('Unsupported file format. Use .json or .csv');
    process.exit(1);
  }

  console.log(`📊 Loaded ${houses.length} houses from ${path.basename(filePath)}`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const house of houses) {
    try {
      const existing = await db.query(
        `SELECT id FROM validation.partner_houses WHERE slug = $1`,
        [house.slug.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        updated++;
      } else {
        inserted++;
      }

      await upsertBySlug(house);
    } catch (error) {
      console.error(`❌ Failed to upsert ${house.slug}:`, error);
      skipped++;
    }
  }

  console.log('\n📈 Summary:');
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);

  await db.end();
  process.exit(skipped > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});