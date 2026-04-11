"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveEvent = exports.createEvent = void 0;
// Re-export from eventRepository for backward compatibility
var eventRepository_1 = require("./eventRepository");
Object.defineProperty(exports, "createEvent", { enumerable: true, get: function () { return eventRepository_1.createEvent; } });
Object.defineProperty(exports, "saveEvent", { enumerable: true, get: function () { return eventRepository_1.saveEvent; } });
//# sourceMappingURL=event.repository.js.map