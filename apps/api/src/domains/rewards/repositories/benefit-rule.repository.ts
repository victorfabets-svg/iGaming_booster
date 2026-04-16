import { pool, queryOne, query } from '../../../../shared/database/connection';

export interface BenefitRule {
  id: string;
  min_amount: number;
  numbers_generated: number;
  access_days: number;
  version: string;
  risk_multiplier?: number;
  max_per_user?: number;
  dynamic_flag?: boolean;
}

export async function findBenefitRuleByAmount(amount: number): Promise<BenefitRule | null> {
  return await queryOne<BenefitRule>(
    `SELECT id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag
     FROM rewards.benefit_rules
     WHERE min_amount <= $1
     ORDER BY min_amount DESC
     LIMIT 1`,
    [amount]
  );
}

export async function findDynamicBenefitRule(amount: number): Promise<BenefitRule | null> {
  return await queryOne<BenefitRule>(
    `SELECT id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag
     FROM rewards.benefit_rules
     WHERE dynamic_flag = TRUE AND min_amount <= $1
     ORDER BY min_amount DESC
     LIMIT 1`,
    [amount]
  );
}

export async function getAllBenefitRules(): Promise<BenefitRule[]> {
  const result = await pool.query(
    `SELECT id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag
     FROM rewards.benefit_rules
     ORDER BY min_amount ASC`
  );
  return result.rows;
}

export async function createBenefitRule(input: Omit<BenefitRule, 'id'>): Promise<BenefitRule> {
  const result = await pool.query(
    `INSERT INTO rewards.benefit_rules (min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, min_amount, numbers_generated, access_days, version, risk_multiplier, max_per_user, dynamic_flag`,
    [input.min_amount, input.numbers_generated, input.access_days, input.version, input.risk_multiplier ?? 1.0, input.max_per_user ?? null, input.dynamic_flag ?? false]
  );
  return result.rows[0];
}