"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBenefitRuleByAmount = findBenefitRuleByAmount;
exports.findDynamicBenefitRule = findDynamicBenefitRule;
exports.getAllBenefitRules = getAllBenefitRules;
exports.createBenefitRule = createBenefitRule;
const database_1 = require("../../../lib/database");
async function findBenefitRuleByAmount(amount) {
    return await (0, database_1.queryOne)(`SELECT id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag
     FROM rewards.benefit_rules
     WHERE min_amount <= $1
     ORDER BY min_amount DESC
     LIMIT 1`, [amount]);
}
async function findDynamicBenefitRule(amount) {
    return await (0, database_1.queryOne)(`SELECT id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag
     FROM rewards.benefit_rules
     WHERE dynamic_flag = TRUE AND min_amount <= $1
     ORDER BY min_amount DESC
     LIMIT 1`, [amount]);
}
async function getAllBenefitRules() {
    const result = await database_1.pool.query(`SELECT id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag
     FROM rewards.benefit_rules
     ORDER BY min_amount ASC`);
    return result.rows;
}
async function createBenefitRule(input) {
    const result = await database_1.pool.query(`INSERT INTO rewards.benefit_rules (min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag`, [input.min_amount, input.numbers_generated, input.access_days, input.version, input.risk_multiplier ?? 1.0, input.max_per_user ?? null, input.dynamic_flag ?? false]);
    return result.rows[0];
}
//# sourceMappingURL=benefit-rule.repository.js.map