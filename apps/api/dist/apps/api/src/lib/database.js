"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.queryOne = queryOne;
exports.execute = execute;
exports.closePool = closePool;
const pg_1 = require("pg");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
}
exports.pool = new pg_1.Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
async function query(text, params) {
    const result = await exports.pool.query(text, params);
    return result.rows;
}
async function queryOne(text, params) {
    const result = await exports.pool.query(text, params);
    return result.rows[0] || null;
}
async function execute(text, params) {
    const result = await exports.pool.query(text, params);
    return result.rowCount || 0;
}
async function closePool() {
    await exports.pool.end();
}
//# sourceMappingURL=database.js.map