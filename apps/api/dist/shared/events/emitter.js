"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitEvent = emitEvent;
const crypto_1 = require("crypto");
const eventRepository_1 = require("./eventRepository");
const REQUIRED_FIELDS = ['event_type', 'producer', 'payload'];
const DEFAULT_VERSION = 'v1';
function validateEventInput(event) {
    for (const field of REQUIRED_FIELDS) {
        if (!event[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    if (!event.payload || typeof event.payload !== 'object') {
        throw new Error('Invalid payload: must be an object');
    }
}
function normalizeEventInput(event) {
    const event_id = event.event_id || (0, crypto_1.randomUUID)();
    const timestamp = event.timestamp || new Date().toISOString();
    const version = event.version || DEFAULT_VERSION;
    const correlation_id = event.correlation_id || event_id;
    const event_type = event.event_type;
    const producer = event.producer;
    const payload = event.payload;
    return {
        event_id,
        event_type,
        version,
        timestamp,
        producer,
        correlation_id,
        payload,
    };
}
async function emitEvent(event) {
    validateEventInput(event);
    const normalizedEvent = normalizeEventInput(event);
    await (0, eventRepository_1.saveEvent)(normalizedEvent);
    console.log(`[EVENT_EMITTED] ${normalizedEvent.event_type}, ${normalizedEvent.event_id}`);
    return normalizedEvent;
}
//# sourceMappingURL=emitter.js.map