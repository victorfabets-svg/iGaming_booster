"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureProcessedEventsTable = ensureProcessedEventsTable;
exports.isEventProcessed = isEventProcessed;
exports.markEventProcessed = markEventProcessed;
exports.fetchUnprocessedEvents = fetchUnprocessedEvents;
const database_1 = require("../../lib/database");
const CONSUMER_NAME = 'proof-submitted-consumer';
async function ensureProcessedEventsTable() {
    await (0, database_1.execute)(`
    CREATE TABLE IF NOT EXISTS events.processed_events (
      event_id UUID NOT NULL,
      consumer_name TEXT NOT NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, consumer_name)
    );
  `);
}
async function isEventProcessed(eventId) {
    const result = await (0, database_1.queryOne)(`SELECT 1 FROM events.processed_events 
     WHERE event_id = $1 AND consumer_name = $2`, [eventId, CONSUMER_NAME]);
    return !!result;
}
async function markEventProcessed(eventId) {
    await (0, database_1.execute)(`INSERT INTO events.processed_events (event_id, consumer_name, processed_at) 
     VALUES ($1, $2, NOW())
     ON CONFLICT DO NOTHING`, [eventId, CONSUMER_NAME]);
}
async function fetchUnprocessedEvents(eventType, limit = 10) {
    // Get events that haven't been processed by this consumer
    const result = await database_1.pool.query(`SELECT e.id, e.event_type, e.version, e.timestamp, e.producer, e.correlation_id, e.payload
     FROM events.events e
     LEFT JOIN events.processed_events pe 
       ON e.id = pe.event_id AND pe.consumer_name = $1
     WHERE e.event_type = $2 AND pe.event_id IS NULL
     ORDER BY e.timestamp ASC
     LIMIT $3`, [CONSUMER_NAME, eventType, limit]);
    return result.rows;
}
//# sourceMappingURL=event-consumer.repository.js.map