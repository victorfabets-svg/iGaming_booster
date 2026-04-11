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
exports.executeRaffleDraw = executeRaffleDraw;
const crypto = __importStar(require("crypto"));
const raffle_repository_1 = require("../../rewards/repositories/raffle.repository");
const ticket_repository_1 = require("../../rewards/repositories/ticket.repository");
const raffle_draw_repository_1 = require("../repositories/raffle-draw.repository");
const event_repository_1 = require("../../../../../../shared/events/event.repository");
const logger_1 = require("../../../../../../shared/observability/logger");
const metrics_service_1 = require("../../../../../../shared/observability/metrics.service");
const feature_flags_1 = require("../../../../../../shared/config/feature-flags");
function generateSeed(raffleId, timestamp) {
    // Deterministic seed: hash of raffle_id + timestamp (as ISO string)
    const data = `${raffleId}:${timestamp.toISOString()}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
}
function calculateResultNumber(seed, raffleId, totalNumbers) {
    // Deterministic algorithm: hash(seed + raffle_id) -> modulo total_numbers + 1
    const data = `${seed}:${raffleId}`;
    const hash = crypto.createHash('sha256').update(data).digest();
    const result = hash.readUInt32BE(0);
    return (result % totalNumbers) + 1;
}
async function executeRaffleDraw(input) {
    const { raffle_id } = input;
    // Check if raffle is enabled
    if (!(0, feature_flags_1.isRaffleEnabled)()) {
        logger_1.logger.warn('raffle_disabled', 'raffles', 'Raffle execution is currently disabled', undefined, { raffle_id });
        throw new Error('Raffle execution is currently disabled');
    }
    console.log(`🎰 Executing raffle draw for raffle: ${raffle_id}`);
    logger_1.logger.info('raffle_execution_started', 'raffles', `Executing raffle draw: ${raffle_id}`, undefined, { raffle_id });
    // Step 1: Load raffle
    const raffle = await (0, raffle_repository_1.findRaffleById)(raffle_id);
    if (!raffle) {
        throw new Error(`Raffle not found: ${raffle_id}`);
    }
    console.log(`📋 Raffle: ${raffle.name}, total_numbers: ${raffle.total_numbers}, status: ${raffle.status}`);
    // Step 2: Check if raffle is active
    if (raffle.status !== 'active') {
        throw new Error(`Raffle is not active: ${raffle.status}`);
    }
    // Step 3: Check if draw already executed (idempotency)
    const existingDraw = await (0, raffle_draw_repository_1.findRaffleDrawByRaffleId)(raffle_id);
    if (existingDraw) {
        console.log(`⏭️  Draw already executed for raffle: ${raffle_id}, returning existing result`);
        return {
            raffle_id: raffle_id,
            winning_number: existingDraw.result_number,
            user_id: existingDraw.winner_user_id,
            seed: existingDraw.seed,
        };
    }
    // Step 4: Generate deterministic seed
    const timestamp = new Date();
    const seed = generateSeed(raffle_id, timestamp);
    console.log(`🔐 Generated seed: ${seed}`);
    // Step 5: Calculate result number
    const resultNumber = calculateResultNumber(seed, raffle_id, raffle.total_numbers);
    console.log(`🎯 Calculated result number: ${resultNumber}`);
    // Step 6: Persist draw result
    const draw = await (0, raffle_draw_repository_1.createRaffleDraw)({
        raffle_id: raffle_id,
        seed: seed,
        algorithm: 'sha256_modulo',
        result_number: resultNumber,
    });
    console.log(`💾 Persisted raffle draw: ${draw.id}`);
    // Step 7: Find winning ticket
    const tickets = await (0, ticket_repository_1.findTicketsByRaffleId)(raffle_id);
    console.log(`🎫 Found ${tickets.length} tickets in raffle`);
    if (tickets.length === 0) {
        console.log(`⚠️  No tickets in raffle, draw completed without winner`);
        // Update raffle status anyway
        await (0, raffle_repository_1.updateRaffleStatus)(raffle_id, 'executed');
        // Emit raffle_draw_executed event
        await (0, event_repository_1.createEvent)({
            event_type: 'raffle_draw_executed',
            version: 'v1',
            payload: {
                raffle_id: raffle_id,
                winning_number: resultNumber,
                user_id: null,
                seed: seed,
                ticket_count: 0,
            },
            producer: 'raffles',
        });
        return {
            raffle_id: raffle_id,
            winning_number: resultNumber,
            user_id: '',
            seed: seed,
        };
    }
    const winningTicket = tickets.find(t => t.number === resultNumber);
    if (!winningTicket) {
        // Map result to valid ticket number using deterministic selection
        const mappedNumber = ((resultNumber - 1) % tickets.length) + 1;
        const selectedTicket = tickets[mappedNumber - 1];
        console.log(`🎯 Result number ${resultNumber} not in tickets, mapped to: ${mappedNumber}`);
        // Update draw with winner
        await (0, raffle_draw_repository_1.updateRaffleDrawWinner)(draw.id, selectedTicket.user_id, selectedTicket.id);
        console.log(`🏆 Winner: user_id = ${selectedTicket.user_id}, ticket_number = ${selectedTicket.number}`);
        // Update raffle status
        await (0, raffle_repository_1.updateRaffleStatus)(raffle_id, 'executed');
        // Emit raffle_draw_executed event
        await (0, event_repository_1.createEvent)({
            event_type: 'raffle_draw_executed',
            version: 'v1',
            payload: {
                raffle_id: raffle_id,
                winning_number: selectedTicket.number,
                user_id: selectedTicket.user_id,
                seed: seed,
                ticket_count: tickets.length,
            },
            producer: 'raffles',
        });
        return {
            raffle_id: raffle_id,
            winning_number: selectedTicket.number,
            user_id: selectedTicket.user_id,
            seed: seed,
        };
    }
    // Update draw with winner
    await (0, raffle_draw_repository_1.updateRaffleDrawWinner)(draw.id, winningTicket.user_id, winningTicket.id);
    console.log(`🏆 Winner: user_id = ${winningTicket.user_id}, ticket_number = ${winningTicket.number}`);
    // Step 8: Mark raffle as executed
    await (0, raffle_repository_1.updateRaffleStatus)(raffle_id, 'executed');
    console.log(`✅ Raffle status updated to: executed`);
    // Step 9: Emit raffle_draw_executed event
    await (0, event_repository_1.createEvent)({
        event_type: 'raffle_draw_executed',
        version: 'v1',
        payload: {
            raffle_id: raffle_id,
            winning_number: winningTicket.number,
            user_id: winningTicket.user_id,
            seed: seed,
            ticket_count: tickets.length,
        },
        producer: 'raffles',
    });
    console.log(`✨ Raffle draw completed for: ${raffle_id}`);
    // Record metrics
    (0, metrics_service_1.recordRaffleExecution)(tickets.length > 0 ? 'executed' : 'no_tickets');
    logger_1.logger.info('raffle_execution_completed', 'raffles', `Raffle executed: ${raffle_id}`, undefined, {
        raffle_id,
        winning_number: winningTicket?.number,
        winner_user_id: winningTicket?.user_id,
        seed,
        ticket_count: tickets.length
    });
    return {
        raffle_id: raffle_id,
        winning_number: winningTicket?.number || 0,
        user_id: winningTicket?.user_id || '',
        seed: seed,
    };
}
//# sourceMappingURL=execute-raffle-draw.use-case.js.map