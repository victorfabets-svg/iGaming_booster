"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const connection_1 = require("../../../../shared/database/connection");
const proofs_1 = require("./routes/proofs");
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
    // Health check - MUST reflect real DB state
    app.get('/health', async () => {
        try {
            await connection_1.db.query('SELECT 1');
            return { status: 'ok' };
        }
        catch (err) {
            return { status: 'error' };
        }
    });
    return app;
}
//# sourceMappingURL=app.js.map