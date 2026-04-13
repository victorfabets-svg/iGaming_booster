"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("../../../../shared/config/env");
const connection_1 = require("../../../../shared/database/connection");
async function start() {
    // Try to connect to database, but allow server to start even if it fails
    try {
        console.log('[DB] Attempting to connect to database...');
        await (0, connection_1.connectWithRetry)();
    }
    catch (error) {
        console.error('[DB] Warning: Database connection failed, continuing anyway:', error);
    }
    const app = (0, app_1.buildApp)();
    const port = env_1.config.apiPort;
    try {
        await app.listen({ port });
        console.log(`Server running on port ${port}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
start().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map