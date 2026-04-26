/**
 * Validation Rules Service V1
 * Versioned rule engine for validation decisions.
 * 
 * Rules are pure functions — no I/O, no random, no Date.now().
 * First-match-wins ordered by priority.
 * Versioned by commit (const in code).
 */

import { getFlag } from '@shared/config/feature-flags';

export const RULES_VERSION = 'rules-v1.0.0';
export const RULES_VERSION_STRICT = 'rules-v1.0.0-strict';

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

interface Thresholds {
  high: number;     // >= → rejected
  medium: number;   // >= → manual_review
}

const NORMAL_THRESHOLDS: Thresholds = { high: 0.7, medium: 0.3 };
const STRICT_THRESHOLDS: Thresholds = { high: 0.5, medium: 0.2 };

function getActiveProfile(): { thresholds: Thresholds; version: string } {
  if (getFlag('STRICT_MODE')) {
    return { thresholds: STRICT_THRESHOLDS, version: RULES_VERSION_STRICT };
  }
  return { thresholds: NORMAL_THRESHOLDS, version: RULES_VERSION };
}

/**
 * Evaluate rules and return first match.
 * 
 * @param input - RuleInput with fraud_score, payment_modifier, has_valid_payment_identifier
 * @returns RuleResult with decision, reason, rule_version
 * 
 * Pure function — deterministic for same input.
 */
export function evaluate(input: RuleInput): RuleResult {
  const { thresholds, version } = getActiveProfile();
  const score = input.fraud_score + input.payment_modifier;

  if (!input.has_valid_payment_identifier) {
    return { decision: 'rejected', reason: 'no_valid_payment_identifier', rule_version: version };
  }
  if (score >= thresholds.high) {
    return { decision: 'rejected', reason: 'fraud_score_high', rule_version: version };
  }
  if (score >= thresholds.medium) {
    return { decision: 'manual_review', reason: 'fraud_score_medium', rule_version: version };
  }
  return { decision: 'approved', reason: 'fraud_score_low', rule_version: version };
}