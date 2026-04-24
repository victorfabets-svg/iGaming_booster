/**
 * Mint a development JWT token for QA testing.
 * Usage:
 *   npx ts-node scripts/mint-dev-token.ts --email=qa@example.com
 *   npx ts-node scripts/mint-dev-token.ts --user-id=<uuid>
 *   npx ts-node scripts/mint-dev-token.ts --email=qa@example.com --silent
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as path from 'path';
import { db, connectWithRetry } from '@shared/database/connection';

// Load env from .env file
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
    // Ignore .env errors
  }
}

loadEnv();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production-32chars';

// Parse CLI args
const args = process.argv.slice(2);
let targetEmail: string | null = null;
let targetUserId: string | null = null;
let silent = false;

for (const arg of args) {
  if (arg.startsWith('--email=')) {
    targetEmail = arg.slice('--email='.length);
  } else if (arg.startsWith('--user-id=')) {
    targetUserId = arg.slice('--user-id='.length);
  } else if (arg === '--silent') {
    silent = true;
  }
}

if (!targetEmail && !targetUserId) {
  console.error('Usage: ts-node scripts/mint-dev-token.ts --email=<email> [--silent]');
  console.error('   or: ts-node scripts/mint-dev-token.ts --user-id=<uuid> [--silent]');
  process.exit(1);
}

async function getOrCreateUser(email: string | null, userId: string | null): Promise<{ user_id: string; email: string }> {
  await connectWithRetry();

  if (userId) {
    // Lookup by user_id
    const existing = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM identity.users WHERE id = $1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return { user_id: existing.rows[0].id, email: existing.rows[0].email };
    }
    // If user doesn't exist, create with the given user_id
    if (email) {
      await db.query(
        `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [userId, email]
      );
    }
    return { user_id: userId, email: email || 'unknown' };
  }

  if (email) {
    // Lookup or create by email
    const existing = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM identity.users WHERE email = $1`,
      [email]
    );
    if (existing.rows.length > 0) {
      return { user_id: existing.rows[0].id, email: existing.rows[0].email };
    }

    // Create user
    const newId = crypto.randomUUID();
    await db.query(
      `INSERT INTO identity.users (id, email, created_at) VALUES ($1, $2, NOW())`,
      [newId, email]
    );
    return { user_id: newId, email };
  }

  throw new Error('Either --email or --user-id must be provided');
}

async function main(): Promise<void> {
  const { user_id, email } = await getOrCreateUser(targetEmail, targetUserId);

  const payload = { user_id, email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

  if (silent) {
    console.log(token);
  } else {
    console.log('✅ JWT token generated');
    console.log(`   user_id : ${user_id}`);
    console.log(`   email   : ${email}`);
    console.log(`   token   : ${token}`);
    console.log('');
    console.log('Add to apps/web/.env:');
    console.log(`   VITE_DEV_JWT=${token}`);
  }

  await db.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err.message);
  try { await db.end(); } catch {}
  process.exit(1);
});