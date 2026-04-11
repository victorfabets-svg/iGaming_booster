"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureProcessedEventsTable = ensureProcessedEventsTable;
exports.fetchUnprocessedEvents = fetchUnprocessedEvents;
exports.markEventProcessed = markEventProcessed;
const connection_1 = require("../database/connection");
async function ensureProcessedEventsTable() {
    await connection_1.db.query(`
    CREATE TABLE IF NOT EXISTS events.processed_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
async function fetchUnprocessedEvents(limit = 100) {
    await ensureProcessedEventsTable();
    const result = await connection_1.db.query(`SELECT e.* 
     FROM events.events e
     LEFT JOIN events.processed_events pe ON e.id = pe.event_id
     WHERE pe.event_id IS NULL
     ORDER BY e.timestamp ASC
     LIMIT $1`, [limit]);
    return result.rows;
}
async function markEventProcessed(eventId) {
    await connection_1.db.query(`INSERT INTO events.processed_events (event_id, processed_at) 
     VALUES ($1, NOW()) 
     ON CONFLICT (event_id) DO UPDATE SET processed_at = NOW()`, [eventId]);
}
//# sourceMappingURL=event-consumer.repository.js.map