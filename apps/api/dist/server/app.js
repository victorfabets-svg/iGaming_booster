"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const database_1 = require("../lib/database");
const proofs_1 = require("./routes/proofs");
const rewards_1 = require("./routes/rewards");
const raffles_1 = require("./routes/raffles");
const events_1 = require("./routes/events");
const metrics_controller_1 = require("../shared/observability/metrics.controller");
function buildApp() {
    const app = (0, fastify_1.default)({
        logger: true,
    });
    // Register multipart plugin for file uploads
    app.register(multipart_1.default, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit
        },
    });
    // Register routes
    app.register(proofs_1.proofRoutes);
    app.register(rewards_1.rewardRoutes);
    app.register(raffles_1.raffleRoutes);
    app.register(events_1.eventRoutes);
    app.get('/health', async () => {
        return { status: 'ok' };
    });
    app.get('/health/db', async () => {
        try {
            await database_1.pool.query('SELECT 1');
            return { status: 'ok' };
        }
        catch (error) {
            return { status: 'error' };
        }
    });
    // Metrics endpoint
    app.get('/metrics', async () => {
        return await (0, metrics_controller_1.getMetrics)();
    });
    return app;
}
//# sourceMappingURL=app.js.map