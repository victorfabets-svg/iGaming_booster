"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getDb = getDb;
exports.initDb = initDb;
exports.connectWithRetry = connectWithRetry;
const pg_1 = __importDefault(require("pg"));
// Use the Pool from the imported module
const Pool = pg_1.default.Pool;
// Deterministic singleton - always initialized at module load
let _db = null;
function getDb() {
    if (!_db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return _db;
}
async function initDb(connectionString) {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable not set');
    }
    _db = new Pool({
        connectionString: dbUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
    _db.on('error', (err) => {
        console.error('[DB] Unexpected database error:', err);
    });
    // Test the connection
    try {
        const result = await _db.query('SELECT NOW()');
        console.log('[DB] Connection established:', result.rows[0].now);
    }
    catch (error) {
        console.error('[DB] Failed to connect:', error);
        throw error;
    }
}
exports.db = {
    query: async (text, params) => {
        if (!_db) {
            throw new Error('Database not initialized');
        }
        const result = await _db.query(text, params);
        return { rows: result.rows };
    },
    end: async () => {
        if (_db) {
            await _db.end();
            _db = null;
        }
    },
};
async function connectWithRetry(maxRetries = 5, delayMs = 2000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await initDb();
            console.log('[DB] Connected successfully after', attempt, 'attempt(s)');
            return;
        }
        catch (error) {
            lastError = error;
            console.error(`[DB] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error(`[DB] Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
//# sourceMappingURL=connection.js.map