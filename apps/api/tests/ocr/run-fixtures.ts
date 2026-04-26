/**
 * OCR Fixtures Runner
 * 
 * Runs OCR tests against fixture receipts.
 * 
 * Usage:
 *   ts-node tests/ocr/run-fixtures.ts
 * 
 * Environment:
 *   T3_OCR_REAL_ENABLED=true - Enable real OCR
 *   ANTHROPIC_API_KEY=<key> - Anthropic API key
 * 
 * Exit codes:
 *   0 - Success (no fixtures or all pass)
 *   1 - Failure (some tests failed)
 */

import * as fs from 'fs';
import * as path from 'path';

import { runOcr, OcrInput } from '../../src/domains/validation/services/ocr.service';
import { matchHouseFromOcr } from '../../src/domains/validation/services/payment-identifier-matcher.service';
import { getFlag } from '@shared/config/feature-flags';

interface ExpectedResult {
  amount: number;
  payment_identifier: string;
  currency: string;
  expected_house_slug?: string;
}

/**
 * Get list of fixture images.
 */
function getFixtureImages(fixturesDir: string): string[] {
  const images: string[] = [];
  const exts = ['.png', '.jpg', '.jpeg'];

  for (const file of fs.readdirSync(fixturesDir)) {
    const ext = path.extname(file).toLowerCase();
    if (exts.includes(ext)) {
      images.push(file);
    }
  }

  return images;
}

/**
 * Load expected results for a fixture.
 */
function loadExpectedResults(fixturesDir: string, imageName: string): ExpectedResult | null {
  const expectedPath = path.join(
    fixturesDir,
    imageName.replace(/\.(png|jpg|jpeg)$/i, '.expected.json')
  );

  if (!fs.existsSync(expectedPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
}

/**
 * Main test runner.
 */
async function main(): Promise<void> {
  const fixturesDir = path.join(__dirname, '../fixtures/receipts');

  // Check if fixtures directory exists
  if (!fs.existsSync(fixturesDir)) {
    console.log('📁 Fixtures directory not found, skipping');
    process.exit(0);
  }

  // Get fixture images
  const images = getFixtureImages(fixturesDir);

  if (images.length === 0) {
    console.log('📁 No fixtures present, skipping');
    process.exit(0);
  }

  // Check if OCR is enabled
  if (!getFlag('T3_OCR_REAL_ENABLED')) {
    console.log('⚠️  OCR not active (T3_OCR_REAL_ENABLED=false), skipping');
    process.exit(0);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  OCR not active (ANTHROPIC_API_KEY not set), skipping');
    process.exit(0);
  }

  console.log(`📊 Running ${images.length} fixture(s)`);

  let passed = 0;
  let failed = 0;

  for (const image of images) {
    const imagePath = path.join(fixturesDir, image);
    const expected = loadExpectedResults(fixturesDir, image);

    console.log(`\n🔍 Testing: ${image}`);

    if (!expected) {
      console.log(`   ⚠️  No expected.json, skipping`);
      continue;
    }

    // Run OCR - use data URL for local files
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const ext = path.extname(image).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${mediaType};base64,${base64}`;

    // FIX-10: file_hash is computed by provider from content, not passed in
    const ocrInput: OcrInput = {
      file_url: dataUrl,
    };

    const ocrResult = await runOcr(ocrInput);

    // Check result
    let testPassed = true;

    if (ocrResult.status !== 'success') {
      console.log(`   ❌ OCR status: ${ocrResult.status} (${ocrResult.reason})`);
      testPassed = false;
    } else {
      if (expected.amount && ocrResult.amount !== expected.amount) {
        console.log(`   ❌ Amount mismatch: got ${ocrResult.amount}, expected ${expected.amount}`);
        testPassed = false;
      }

      if (expected.currency && ocrResult.currency !== expected.currency) {
        console.log(`   ❌ Currency mismatch: got ${ocrResult.currency}, expected ${expected.currency}`);
        testPassed = false;
      }
    }

    if (testPassed) {
      console.log(`   ✅ PASS`);
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n📈 Summary:');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});