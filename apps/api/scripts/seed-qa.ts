/**
 * Seed QA user and proof fixtures for Sprint 6 frontend QA.
 * Creates qa@example.com with a known UUID, plus one proof per status terminal.
 *
 * Usage:
 *   npx ts-node scripts/seed-qa.ts
 */

import * as path from 'path';
import * as crypto from 'crypto';
import { db, connectWithRetry, closePool } from '@shared/database/connection';
import { createProofValidation } from '../src/domains/validation/repositories/proof-validation.repository';

const QA_EMAIL = 'qa@example.com';
const QA_USER_ID = '00000000-0000-0000-0000-000000000001';

function loadEnv(): void {
  const envPath = path.join(__dirname, '../../.env');
  try {
    const fs = require('fs');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

loadEnv();

async function ensureSchema(): Promise<void> {
  // Ensure schemas exist (in case migrations haven't run yet)
  await db.query(`CREATE SCHEMA IF NOT EXISTS identity;`);
  await db.query(`CREATE SCHEMA IF NOT EXISTS validation;`);
  await db.query(`CREATE SCHEMA IF NOT EXISTS events;`);
}

async function seedUser(): Promise<string> {
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM identity.users WHERE email = $1`,
    [QA_EMAIL]
  );

  if (existing.rows.length > 0) {
    console.log(`✅ User already exists: ${existing.rows[0].id}`);
    return existing.rows[0].id;
  }

  await db.query(
    `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW())`,
    [QA_USER_ID, QA_EMAIL]
  );
  console.log(`✅ User created: ${QA_USER_ID}`);
  return QA_USER_ID;
}

interface ProofFixture {
  filename: string;
  status: 'approved' | 'rejected' | 'manual_review' | 'processing';
  confidence_score: number;
}

async function seedProofs(userId: string): Promise<{ proof_id: string; status: string }[]> {
  const fixtures: ProofFixture[] = [
    { filename: 'fixture-approved.png', status: 'approved', confidence_score: 0.95 },
    { filename: 'fixture-rejected.png', status: 'rejected', confidence_score: 0.10 },
    { filename: 'fixture-manual-review.png', status: 'manual_review', confidence_score: 0.65 },
    { filename: 'fixture-processing.png', status: 'processing', confidence_score: 0.0 },
  ];

  const results: { proof_id: string; status: string }[] = [];

  for (const fixture of fixtures) {
    const proofId = crypto.randomUUID();
    const fileUrl = `mock://qa-fixtures/${fixture.filename}`;
    const hash = crypto.createHash('sha256').update(fixture.filename).digest('hex');

    // Insert proof
    await db.query(
      `INSERT INTO validation.proofs (id, user_id, file_url, hash, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [proofId, userId, fileUrl, hash]
    );

    // Insert validation
    await createProofValidation({
      proof_id: proofId,
      status: fixture.status,
      validation_version: 'qa-fixture',
    });

    // Update confidence score
    await db.query(
      `UPDATE validation.proof_validations
       SET confidence_score = $1, validated_at = NOW()
       WHERE proof_id = $2`,
      [fixture.confidence_score, proofId]
    );

    console.log(`✅ Proof seeded: ${proofId} → ${fixture.status}`);
    results.push({ proof_id: proofId, status: fixture.status });
  }

  return results;
}

async function main(): Promise<void> {
  console.log('===========================================');
  console.log('🔧 QA Seed Script');
  console.log('===========================================');

  await connectWithRetry();
  console.log('✅ Database connected');

  await ensureSchema();
  console.log('✅ Schemas ready');

  const userId = await seedUser();
  const proofs = await seedProofs(userId);

  console.log('');
  console.log('===========================================');
  console.log('📋 QA Fixtures Summary');
  console.log('===========================================');
  console.log(`email   : ${QA_EMAIL}`);
  console.log(`user_id : ${userId}`);
  console.log('');
  console.log('Proofs:');
  for (const p of proofs) {
    console.log(`  ${p.status.padEnd(14)} ${p.proof_id}`);
  }

  console.log('');
  console.log('===========================================');
  console.log('💻 Commands for frontend .env:');
  console.log('===========================================');
  console.log('');
  console.log('# JWT for qa@example.com:');
  console.log('JWT=$(cd apps/api && npx ts-node scripts/mint-dev-token.ts --email=qa@example.com --silent)');
  console.log('echo "VITE_DEV_JWT=$JWT" >> apps/web/.env');
  console.log('');
  console.log('# Approved proof_id:');
  console.log(`export APPROVED_PROOF_ID="${proofs.find(p => p.status === 'approved')?.proof_id}"`);
  console.log('');
  console.log('# Rejected proof_id:');
  console.log(`export REJECTED_PROOF_ID="${proofs.find(p => p.status === 'rejected')?.proof_id}"`);
  console.log('');
  console.log('# Manual review proof_id:');
  console.log(`export MANUAL_REVIEW_PROOF_ID="${proofs.find(p => p.status === 'manual_review')?.proof_id}"`);

  console.log('');
  console.log('✅ Seed complete!');

  await closePool();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Seed failed:', err.message);
  try { await closePool(); } catch {}
  process.exit(1);
});