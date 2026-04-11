"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFormattedMetrics = exports.recordRaffleExecution = exports.recordTicketGenerated = exports.recordReward = exports.recordFraudSignal = exports.recordValidationResult = exports.recordProofSubmission = exports.metricsService = exports.alertMonitor = exports.logger = void 0;
var logger_1 = require("./logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
Object.defineProperty(exports, "alertMonitor", { enumerable: true, get: function () { return logger_1.alertMonitor; } });
var metrics_service_1 = require("./metrics.service");
Object.defineProperty(exports, "metricsService", { enumerable: true, get: function () { return metrics_service_1.metricsService; } });
Object.defineProperty(exports, "recordProofSubmission", { enumerable: true, get: function () { return metrics_service_1.recordProofSubmission; } });
Object.defineProperty(exports, "recordValidationResult", { enumerable: true, get: function () { return metrics_service_1.recordValidationResult; } });
Object.defineProperty(exports, "recordFraudSignal", { enumerable: true, get: function () { return metrics_service_1.recordFraudSignal; } });
Object.defineProperty(exports, "recordReward", { enumerable: true, get: function () { return metrics_service_1.recordReward; } });
Object.defineProperty(exports, "recordTicketGenerated", { enumerable: true, get: function () { return metrics_service_1.recordTicketGenerated; } });
Object.defineProperty(exports, "recordRaffleExecution", { enumerable: true, get: function () { return metrics_service_1.recordRaffleExecution; } });
Object.defineProperty(exports, "getFormattedMetrics", { enumerable: true, get: function () { return metrics_service_1.getFormattedMetrics; } });
//# sourceMappingURL=index.js.map