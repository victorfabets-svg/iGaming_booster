import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { db, connectWithRetry } from '@shared/database/connection';

// Prefer NEON_DB_URL_DIRECT (neondb_owner, direct/non-pooled) for DDL. Falls
// back to NEON_DB_URL when only one secret is configured (local/dev). See
// secret mapping note in .github/workflows/migrate.yml — secret names in this
// repo map to ROLE identity, not workload.
const migrationUrl = process.env.NEON_DB_URL_DIRECT || process.env.NEON_DB_URL;
if (migrationUrl) {
  process.env.NEON_DB_URL = migrationUrl;
}

const MIGRATIONS_DIR = path.join(__dirname, '../../../../shared/database/migrations');

// STRICT mode: abort on any divergence. When false (default), errors with
// SQLSTATE in {42P06, 42P07, 42710, 42701} are treated as already-applied
// (drift recovery). Toggled by MIGRATIONS_STRICT=true (set by workflow input).
const STRICT_MODE = process.env.MIGRATIONS_STRICT === 'true';

// Postgres SQLSTATE codes meaning "this object already exists".
// 42P06: duplicate_schema, 42P07: duplicate_table/index/relation,
// 42710: duplicate_object (constraints, types), 42701: duplicate_column.
const ALREADY_EXISTS_CODES = new Set(['42P06', '42P07', '42710', '42701']);

// Schemas expected by migration files (defined in 001_init.sql, 005_payments_layer.sql, etc.)
const EXPECTED_SCHEMAS = [
  'identity', 'validation', 'fraud', 'rewards', 'raffles',
  'events', 'infra', 'audit', 'tipster', 'payments', 'affiliate', 'whatsapp', 'subscription',
];

interface Migration {
  filename: string;
  executed_at: Date;
}

async function ensureUuidExtension(): Promise<void> {
  await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
}

async function ensureExpectedSchemas(): Promise<void> {
  for (const schema of EXPECTED_SCHEMAS) {
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
  }
}

async function ensureMigrationsTable(): Promise<void> {
  // Schema must exist before creating the table inside it
  await db.query(`CREATE SCHEMA IF NOT EXISTS events;`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS events.migrations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Migration[]> {
  const result = await db.query<Migration>(
    `SELECT filename, executed_at FROM events.migrations ORDER BY executed_at ASC`
  );
  return result.rows;
}

async function markMigrationExecuted(filename: string): Promise<void> {
  await db.query(
    `INSERT INTO events.migrations (id, filename, executed_at) VALUES ($1, $2, NOW())`,
    [randomUUID(), filename]
  );
}

async function runMigrations(): Promise<void> {
  console.log('===================================================');
  console.log('🔄 Migration Runner STARTED');
  console.log('===================================================');
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`);

  // Connect to database first
  await connectWithRetry();
  console.log('✅ Database connected');

  await ensureUuidExtension();
  console.log('✅ uuid-ossp extension ensured');

  await ensureExpectedSchemas();
  console.log('✅ Expected schemas ensured');

  // Ensure migrations table exists
  await ensureMigrationsTable();
  console.log('✅ Migrations tracking table ready');

  // Get list of executed migrations
  const executedMigrations = await getExecutedMigrations();
  const executedFilenames = new Set(executedMigrations.map(m => m.filename));
  console.log(`📊 Already executed: ${executedFilenames.size} migrations`);

  // Get all migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`📄 Found ${files.length} migration files`);
  if (STRICT_MODE) {
    console.log('⚙️  STRICT mode ON — any divergence will abort');
  }

  if (files.length === 0) {
    console.log('✨ No migrations to run');
    return;
  }

  let executedCount = 0;
  let reconciledCount = 0;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    if (executedFilenames.has(file)) {
      console.log(`⏭️  ALREADY RUN: ${file}`);
      continue;
    }

    console.log(`🚀 EXECUTING: ${file}`);

    // Execute migration inside a transaction so partial failures don't leak.
    let reconciled = false;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      const code = (error as { code?: string })?.code;
      if (!STRICT_MODE && code && ALREADY_EXISTS_CODES.has(code)) {
        console.log(`♻️ AUTO-RECONCILE: ${file} (SQLSTATE ${code}) — marking applied`);
        reconciled = true;
      } else {
        client.release();
        console.error('===================================================');
        console.error('❌ MIGRATION FAILED');
        console.error(`   File: ${file}`);
        console.error(`   Error: ${error}`);
        if (code) console.error(`   SQLSTATE: ${code}`);
        console.error('===================================================');
        await db.end();
        process.exit(1);
      }
    } finally {
      client.release();
    }

    // Mark as executed (whether actually run or reconciled).
    try {
      await markMigrationExecuted(file);
    } catch (error) {
      console.error('===================================================');
      console.error('❌ FAILED TO MARK MIGRATION EXECUTED');
      console.error(`   File: ${file}`);
      console.error(`   Error: ${error}`);
      console.error('===================================================');
      await db.end();
      process.exit(1);
    }

    if (reconciled) {
      reconciledCount++;
    } else {
      console.log(`✅ Migration executed: ${file}`);
      executedCount++;
    }
  }

  console.log('===================================================');
  console.log('📈 Migration Summary:');
  console.log(`   Executed: ${executedCount}`);
  console.log(`   Auto-reconciled: ${reconciledCount}`);
  console.log(`   Strict mode: ${STRICT_MODE ? 'on' : 'off'}`);
  console.log('===================================================');
  console.log('✨ Migration runner finished');
  console.log('===================================================');

  await db.end();
}

// HARD FAIL - no silent failures
runMigrations().catch((error) => {
  console.error('===================================================');
  console.error('❌ FATAL ERROR - Migration runner crashed');
  console.error(`   Error: ${error}`);
  console.error('===================================================');
  process.exit(1);
});