"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventRoutes = eventRoutes;
const event_repository_1 = require("../../shared/events/event.repository");
async function eventRoutes(fastify) {
    // Get all events (last 50, sorted by timestamp DESC)
    fastify.get('/events', async () => {
        const events = await (0, event_repository_1.findAllEvents)(50);
        return events;
    });
}
//# sourceMappingURL=events.js.map