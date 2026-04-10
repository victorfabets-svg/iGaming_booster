import * as fs from 'fs';
import * as path from 'path';
import { pool, execute, queryOne, closePool } from '../../lib/database';

const MIGRATIONS_DIR = path.join(__dirname, '../../../shared/database/migrations');

interface Migration {
  filename: string;
  executed_at: Date;
}

async function ensureMigrationsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS events.migrations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Migration[]> {
  return await queryOne<Migration>(
    `SELECT filename, executed_at FROM events.migrations ORDER BY executed_at ASC`
  ) as unknown as Migration[] || [];
}

async function markMigrationExecuted(filename: string): Promise<void> {
  await execute(
    `INSERT INTO events.migrations (filename, executed_at) VALUES ($1, NOW())`,
    [filename]
  );
}

async function runMigrations(): Promise<void> {
  console.log('🔄 Starting migration runner...');
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`);

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

  let executed = 0;
  let skipped = 0;

  for (const file of files) {
    if (executedFilenames.has(file)) {
      console.log(`⏭️  Skipping: ${file} (already executed)`);
      skipped++;
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`🚀 Executing: ${file}`);

    try {
      await execute(sql);
      await markMigrationExecuted(file);
      console.log(`✅ Completed: ${file}`);
      executed++;
    } catch (error) {
      console.error(`❌ Failed: ${file}`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`   Executed: ${executed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log('✨ Migration runner finished');

  await closePool();
}

runMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});