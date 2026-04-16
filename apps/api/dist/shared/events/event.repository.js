"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvent = createEvent;
exports.findEventsByType = findEventsByType;
exports.findAllEvents = findAllEvents;
const database_1 = require("../../lib/database");
const crypto_1 = require("crypto");
async function createEvent(input) {
    const id = (0, crypto_1.randomUUID)();
    const timestamp = new Date().toISOString();
    const correlation_id = input.correlation_id || id;
    const result = await database_1.pool.query(`INSERT INTO events.events (id, event_type, version, timestamp, producer, correlation_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, event_type, version, timestamp, producer, correlation_id, payload`, [id, input.event_type, input.version, timestamp, input.producer, correlation_id, JSON.stringify(input.payload)]);
    return result.rows[0];
}
async function findEventsByType(eventType) {
    const result = await database_1.pool.query(`SELECT id, event_type, version, timestamp, producer, correlation_id, payload
     FROM events.events
     WHERE event_type = $1
     ORDER BY timestamp DESC`, [eventType]);
    return result.rows;
}
async function findAllEvents(limit = 50) {
    const result = await database_1.pool.query(`SELECT id, event_type, version, timestamp, producer, correlation_id, payload
     FROM events.events
     ORDER BY timestamp DESC
     LIMIT $1`, [limit]);
    return result.rows;
}
//# sourceMappingURL=event.repository.js.map