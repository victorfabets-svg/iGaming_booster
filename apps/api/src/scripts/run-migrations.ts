import * as fs from 'fs';
import * as path from 'path';
import { db, connectWithRetry } from '@shared/database/connection';

const MIGRATIONS_DIR = path.join(__dirname, '../../../../shared/database/migrations');

interface Migration {
  filename: string;
  executed_at: Date;
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
    `INSERT INTO events.migrations (filename, executed_at) VALUES ($1, NOW())`,
    [filename]
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

  if (files.length === 0) {
    console.log('✨ No migrations to run');
    return;
  }

  let executedCount = 0;

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    if (executedFilenames.has(file)) {
      console.log(`⏭️  ALREADY RUN: ${file}`);
      continue;
    }

    console.log(`🚀 EXECUTING: ${file}`);

    // Execute migration - HARD FAIL on any error
    try {
      await db.query(sql);
    } catch (error) {
      console.error('===================================================');
      console.error('❌ MIGRATION FAILED');
      console.error(`   File: ${file}`);
      console.error(`   Error: ${error}`);
      console.error('===================================================');
      await db.end();
      process.exit(1);
    }

    // Mark as executed
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

    console.log(`✅ Migration executed: ${file}`);
    executedCount++;
  }

  console.log('===================================================');
  console.log('📈 Migration Summary:');
  console.log(`   Executed: ${executedCount}`);
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