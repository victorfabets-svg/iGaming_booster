"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const database_1 = require("../lib/database");
const MIGRATIONS_DIR = path.join(__dirname, '../../shared/database/migrations');
async function ensureMigrationsTable() {
    await (0, database_1.query)(`
    CREATE TABLE IF NOT EXISTS events.migrations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}
async function getExecutedMigrations() {
    const result = await (0, database_1.query)(`SELECT filename, executed_at FROM events.migrations ORDER BY executed_at ASC`);
    return result || [];
}
async function markMigrationExecuted(filename) {
    await (0, database_1.query)(`INSERT INTO events.migrations (filename, executed_at) VALUES ($1, NOW())`, [filename]);
}
async function runMigrations() {
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
            await database_1.pool.query(sql);
            await markMigrationExecuted(file);
            console.log(`✅ Completed: ${file}`);
            executed++;
        }
        catch (error) {
            console.error(`❌ Failed: ${file}`);
            console.error(error);
            process.exit(1);
        }
    }
    console.log('\n📈 Migration Summary:');
    console.log(`   Executed: ${executed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('✨ Migration runner finished');
    await database_1.pool.end();
}
runMigrations().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=run-migrations.js.map