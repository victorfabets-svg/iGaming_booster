"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.experimentService = void 0;
exports.getExperimentVariant = getExperimentVariant;
const crypto = __importStar(require("crypto"));
const database_1 = require("../../../lib/database");
const EXPERIMENTS = {
    reward_tickets: {
        name: 'reward_tickets',
        variants: ['control', 'treatment_a', 'treatment_b'],
    },
    validation_threshold: {
        name: 'validation_threshold',
        variants: ['control', 'stricter', 'lenient'],
    },
};
// Deterministic assignment based on user ID
function assignVariant(userId, variants, weights) {
    // Create deterministic hash from userId
    const hash = crypto.createHash('sha256').update(userId).digest();
    const num = hash.readUInt32BE(0);
    if (!weights || weights.length === 0) {
        // Equal distribution
        return variants[num % variants.length];
    }
    // Weighted distribution
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalized = (num % 1000) / 1000; // 0-1
    const threshold = normalized * totalWeight;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (threshold < cumulative) {
            return variants[i];
        }
    }
    return variants[variants.length - 1];
}
class ExperimentService {
    constructor() { }
    static getInstance() {
        if (!ExperimentService.instance) {
            ExperimentService.instance = new ExperimentService();
        }
        return ExperimentService.instance;
    }
    async assignUserToExperiment(userId, experimentName) {
        // Check if user already assigned
        const existing = await (0, database_1.queryOne)(`SELECT id, user_id, experiment_name, variant, assigned_at
       FROM rewards.experiment_assignments
       WHERE user_id = $1 AND experiment_name = $2`, [userId, experimentName]);
        if (existing) {
            return existing.variant;
        }
        // Get experiment config
        const config = EXPERIMENTS[experimentName];
        if (!config) {
            // Default to control if experiment not found
            return 'control';
        }
        // Assign new variant
        const variant = assignVariant(userId, config.variants, config.weights);
        // Store assignment
        await database_1.pool.query(`INSERT INTO rewards.experiment_assignments (user_id, experiment_name, variant)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, experiment_name) DO NOTHING`, [userId, experimentName, variant]);
        return variant;
    }
    async getUserVariant(userId, experimentName) {
        const assignment = await (0, database_1.queryOne)(`SELECT variant FROM rewards.experiment_assignments
       WHERE user_id = $1 AND experiment_name = $2`, [userId, experimentName]);
        return assignment?.variant || null;
    }
    getExperimentConfig(experimentName) {
        return EXPERIMENTS[experimentName] || null;
    }
    getAllExperiments() {
        return Object.values(EXPERIMENTS);
    }
    // Get variant distribution stats
    async getExperimentStats(experimentName) {
        const result = await (0, database_1.query)(`SELECT variant, COUNT(*) as count
       FROM rewards.experiment_assignments
       WHERE experiment_name = $1
       GROUP BY variant`, [experimentName]);
        const stats = {};
        for (const row of result) {
            stats[row.variant] = parseInt(row.count, 10);
        }
        return stats;
    }
}
exports.experimentService = ExperimentService.getInstance();
// Helper to get variant with default
async function getExperimentVariant(userId, experimentName, defaultVariant = 'control') {
    const variant = await exports.experimentService.getUserVariant(userId, experimentName);
    return variant || defaultVariant;
}
//# sourceMappingURL=experiment.service.js.map