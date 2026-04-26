/**
 * Validation Rules Service V1
 * Versioned rule engine for validation decisions.
 * 
 * Rules are pure functions — no I/O, no random, no Date.now().
 * First-match-wins ordered by priority.
 * Versioned by commit (const in code).
 */

export const RULES_VERSION = 'rules-v1.0.0';

/**
 * Decision types
 */
export type Decision = 'approved' | 'rejected' | 'manual_review';

/**
 * Input for rule evaluation.
 * Score is fraud_score (from fraud_scored event) + payment_modifier (already calculated).
 */
export interface RuleInput {
  fraud_score: number;          // [0, 1]
  payment_modifier: number;    // adjustment already applied
  has_valid_payment_identifier: boolean;
}

/**
 * Result of rule evaluation
 */
export interface RuleResult {
  decision: Decision;
  reason: string;
  rule_version: string;
}

/**
 * Single rule definition
 */
interface Rule {
  id: string;                   // identifier (becomes reason)
  match: (i: RuleInput) => boolean;
  decision: Decision;
}

/**
 * Validation rules — first-match-wins.
 * 
 * Score effective = fraud_score + payment_modifier (same as before, now explicit).
 * payment_modifier comes from aggregator (already computed); rule just consumes.
 */
const RULES: Rule[] = [
  // Reject if no valid payment identifier
  {
    id: 'no_valid_payment_identifier',
    match: (i) => !i.has_valid_payment_identifier,
    decision: 'rejected'
  },
  // Reject if score >= 0.7
  {
    id: 'fraud_score_high',
    match: (i) => (i.fraud_score + i.payment_modifier) >= 0.7,
    decision: 'rejected'
  },
  // Manual review if score >= 0.3
  {
    id: 'fraud_score_medium',
    match: (i) => (i.fraud_score + i.payment_modifier) >= 0.3,
    decision: 'manual_review'
  },
  // Approved — catchall
  {
    id: 'fraud_score_low',
    match: () => true,
    decision: 'approved'
  },
];

/**
 * Evaluate rules and return first match.
 * 
 * @param input - RuleInput with fraud_score, payment_modifier, has_valid_payment_identifier
 * @returns RuleResult with decision, reason, rule_version
 * 
 * Pure function — deterministic for same input.
 */
export function evaluate(input: RuleInput): RuleResult {
  for (const rule of RULES) {
    if (rule.match(input)) {
      return {
        decision: rule.decision,
        reason: rule.id,
        rule_version: RULES_VERSION,
      };
    }
  }
  
  // Defense: never reached due to catchall, but type-safe fallback
  return {
    decision: 'manual_review',
    reason: 'no_rule_matched',
    rule_version: RULES_VERSION,
  };
}