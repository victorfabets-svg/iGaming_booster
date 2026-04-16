"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.connectWithRetry = connectWithRetry;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
// Deterministic singleton - always initialized at module load
exports.db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
// Connection event handlers
exports.db.on('connect', () => {
    console.log('[DB] New client connected to pool');
});
exports.db.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err);
});
async function connectWithRetry(retries = 5, delayMs = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const client = await exports.db.connect();
            console.log(`[DB] Connected on attempt ${attempt}`);
            client.release();
            return;
        }
        catch (err) {
            console.error(`[DB] Attempt ${attempt} failed`, err);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error('DB connection failed after retries');
}
//# sourceMappingURL=connection.js.map