"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("../shared/config/env");
async function start() {
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