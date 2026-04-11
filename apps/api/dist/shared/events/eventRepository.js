"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveEvent = saveEvent;
exports.createEvent = createEvent;
const crypto_1 = require("crypto");
const connection_1 = require("../database/connection");
const REQUIRED_FIELDS = ['event_type', 'version', 'producer', 'payload'];
function validateEvent(event) {
    // Validate strict required fields
    for (const field of REQUIRED_FIELDS) {
        if (!event[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    // Validate payload is object
    if (!event.payload || typeof event.payload !== 'object') {
        throw new Error('Invalid payload: must be an object');
    }
}
function normalizeEvent(event) {
    // Ensure event_id exists
    const event_id = event.event_id || (0, crypto_1.randomUUID)();
    // Ensure timestamp is ISO string
    const timestamp = event.timestamp || new Date().toISOString();
    // Ensure correlation_id exists
    const correlation_id = event.correlation_id || event_id;
    return {
        ...event,
        event_id,
        timestamp,
        correlation_id,
    };
}
async function saveEvent(event) {
    const normalized = normalizeEvent(event);
    validateEvent(normalized);
    try {
        await connection_1.db.query(`INSERT INTO events.events (
        id,
        event_type,
        version,
        timestamp,
        producer,
        correlation_id,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            normalized.event_id,
            normalized.event_type,
            normalized.version,
            normalized.timestamp,
            normalized.producer,
            normalized.correlation_id,
            JSON.stringify(normalized.payload),
        ]);
    }
    catch (error) {
        console.error('[EVENT_SAVE_ERROR]', normalized, error);
        throw new Error(`Failed to save event: ${normalized.event_id}`);
    }
}
// Wrapper for domain use - creates and saves event
async function createEvent(event) {
    await saveEvent(event);
}
//# sourceMappingURL=eventRepository.js.map