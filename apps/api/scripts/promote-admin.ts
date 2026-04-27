/**
 * Promote a user to admin role.
 * Usage:
 *   npm run promote-admin -- --email user@example.com
 */

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

// Parse CLI args
const args = process.argv.slice(2);
let targetEmail: string | null = null;

for (const arg of args) {
  if (arg.startsWith('--email=')) {
    targetEmail = arg.slice('--email='.length);
  }
}

if (!targetEmail) {
  console.error('Usage: npm run promote-admin -- --email=<email>');
  console.error('Example: npm run promote-admin -- --email admin@example.com');
  process.exit(1);
}

async function main(): Promise<void> {
  await connectWithRetry();

  // Normalize email
  const normalizedEmail = targetEmail!.toLowerCase().trim();

  // Check if user exists
  const existing = await db.query<{ id: string; email: string; role: string }>(
    `SELECT id, email, role FROM identity.users WHERE email = $1`,
    [normalizedEmail]
  );

  if (existing.rows.length === 0) {
    console.error(`❌ User not found: ${normalizedEmail}`);
    await db.end();
    process.exit(1);
  }

  const user = existing.rows[0];
  if (user.role === 'admin') {
    console.log(`ℹ️  User ${normalizedEmail} is already an admin`);
    await db.end();
    process.exit(0);
  }

  // Promote to admin
  await db.query(
    `UPDATE identity.users SET role = 'admin' WHERE id = $1`,
    [user.id]
  );

  console.log(`✅ User ${normalizedEmail} promoted to admin`);
  console.log(`   user_id: ${user.id}`);

  await db.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err.message);
  try { await db.end(); } catch {}
  process.exit(1);
});