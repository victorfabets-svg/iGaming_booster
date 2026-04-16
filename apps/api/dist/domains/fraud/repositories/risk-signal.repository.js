"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRiskSignal = createRiskSignal;
exports.findRiskSignalsByUserId = findRiskSignalsByUserId;
exports.findRiskSignalsByType = findRiskSignalsByType;
exports.countRiskSignalsByUser = countRiskSignalsByUser;
const database_1 = require("../../../lib/database");
async function createRiskSignal(input) {
    const result = await database_1.pool.query(`INSERT INTO fraud.risk_signals (user_id, signal_type, value, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, signal_type, value, metadata, created_at`, [input.user_id, input.signal_type, input.value, input.metadata ? JSON.stringify(input.metadata) : null]);
    return result.rows[0];
}
async function findRiskSignalsByUserId(userId, limit = 100) {
    return await (0, database_1.query)(`SELECT id, user_id, signal_type, value, metadata, created_at
     FROM fraud.risk_signals
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`, [userId, limit]);
}
async function findRiskSignalsByType(signalType, since) {
    return await (0, database_1.query)(`SELECT id, user_id, signal_type, value, metadata, created_at
     FROM fraud.risk_signals
     WHERE signal_type = $1 AND created_at >= $2
     ORDER BY created_at DESC`, [signalType, since]);
}
async function countRiskSignalsByUser(userId, signalType, since) {
    let sql = `SELECT COUNT(*) as count FROM fraud.risk_signals WHERE user_id = $1`;
    const params = [userId];
    if (signalType) {
        sql += ` AND signal_type = $2`;
        params.push(signalType);
    }
    if (since) {
        const idx = signalType ? 3 : 2;
        sql += ` AND created_at >= $${idx}`;
        params.push(since);
    }
    const result = await (0, database_1.queryOne)(sql, params);
    return parseInt(result?.count || '0', 10);
}
//# sourceMappingURL=risk-signal.repository.js.map