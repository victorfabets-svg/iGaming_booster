/**
 * Fraud Scoring Service V1
 * Deterministic fraud score based on behavioral + content signals.
 * 
 * Behavioral signals (queried from DB):
 * - duplicate_hash_other_users: count of OTHER users who submitted the same hash
 * - user_velocity_1h: user's submits in last 1 hour
 * - user_velocity_24h: user's submits in last 24 hours
 * 
 * Content signals (from payload):
 * - ocr_heuristic_valid: heuristic validation passed
 * - ocr_amount_anomaly: amount too low or too high
 * - ocr_date_anomaly: date in future or too old
 * - institution_known: institution in allowlist
 */

import { fetchBehavioralSignals, BehavioralSignals } from '../repositories/fraud-signals.repository';

export const RULE_VERSION = 'fraud-v1.0.0';

// Known institutions allowlist
const KNOWN_INSTITUTIONS = ['Bank of America', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One'];

// Weight constants - literal values from spec
const WEIGHTS = {
  duplicate_hash_other_users_gt0: 0.5,  // outro user já mandou esse arquivo
  user_velocity_1h_gt5:           0.3,  // burst recente
  user_velocity_24h_gt20:         0.2,  // padrão suspeito
  ocr_heuristic_invalid:          0.4,  // OCR/heurística reprovou
  ocr_amount_anomaly:             0.1,  // valor anômalo
  ocr_date_future:                0.3,  // data no futuro
  ocr_date_old:                   0.05, // muito antigo (suave)
  institution_unknown:            0.1,  // banco desconhecido
} as const;

/**
 * Content signals extracted from OCR/heuristic payload
 */
export interface ContentSignals {
  ocr_heuristic_valid: boolean;
  ocr_amount_anomaly: 'too_low' | 'high_value' | 'normal';
  ocr_date_anomaly: 'future_date' | 'old_transaction' | 'normal';
  institution_known: boolean;
}

/**
 * Full fraud score result
 */
export interface FraudScoreResult {
  fraud_score: number;        // [0, 1]
  rule_version: string;          // 'fraud-v1.0.0'
  signals: {
    behavioral: BehavioralSignals;
    content: ContentSignals;
    weights_applied: string[]; // keys of WEIGHTS that contributed > 0
  };
}

/**
 * Input for calculating fraud score
 */
export interface FraudScoreInput {
  proof_id: string;
  ocr_result?: {
    amount?: number;
    date?: string;
    institution?: string;
    identifier?: string | null;
  };
  heuristic_result?: {
    is_valid?: boolean;
    issues?: string[];
  };
}

/**
 * Parse date string to detect anomalies.
 * Returns null if not parseable.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Extract content signals from input payload
 */
function extractContentSignals(input: FraudScoreInput): ContentSignals {
  const ocr = input.ocr_result || {};
  const heuristic = input.heuristic_result || {};

  // ocr_heuristic_valid: default to true if not provided
  const ocr_heuristic_valid = heuristic.is_valid !== false;

  // ocr_amount_anomaly
  const amount = ocr.amount ?? 0;
  let ocr_amount_anomaly: 'too_low' | 'high_value' | 'normal';
  if (amount < 1) {
    ocr_amount_anomaly = 'too_low';
  } else if (amount > 10000) {
    ocr_amount_anomaly = 'high_value';
  } else {
    ocr_amount_anomaly = 'normal';
  }

  // ocr_date_anomaly
  const parsedDate = parseDate(ocr.date || '');
  let ocr_date_anomaly: 'future_date' | 'old_transaction' | 'normal';
  
  if (parsedDate) {
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo < 0) {
      ocr_date_anomaly = 'future_date';
    } else if (daysAgo > 90) {
      ocr_date_anomaly = 'old_transaction';
    } else {
      ocr_date_anomaly = 'normal';
    }
  } else {
    ocr_date_anomaly = 'normal';
  }

  // institution_known
  const institution_known = KNOWN_INSTITUTIONS.includes(ocr.institution || '');

  return {
    ocr_heuristic_valid,
    ocr_amount_anomaly,
    ocr_date_anomaly,
    institution_known,
  };
}

/**
 * Calculate deterministic fraud score.
 * 
 * This function is async because it queries behavioral signals from DB.
 * For the same proof_id + same DB state, the result is deterministic.
 * 
 * @param input - FraudScoreInput with proof_id and optional OCR/heuristic data
 * @returns FraudScoreResult with score in [0, 1] and signals breakdown
 */
export async function calculateFraudScore(input: FraudScoreInput): Promise<FraudScoreResult> {
  // Fetch behavioral signals from DB
  const behavioral = await fetchBehavioralSignals(input.proof_id);

  // Extract content signals from payload
  const content = extractContentSignals(input);

  // Calculate score deterministically using weights
  let score = 0;
  const weights_applied: string[] = [];

  // Behavioral signals
  if (behavioral.duplicate_hash_other_users > 0) {
    score += WEIGHTS.duplicate_hash_other_users_gt0;
    weights_applied.push('duplicate_hash_other_users_gt0');
  }

  if (behavioral.user_velocity_1h > 5) {
    score += WEIGHTS.user_velocity_1h_gt5;
    weights_applied.push('user_velocity_1h_gt5');
  }

  if (behavioral.user_velocity_24h > 20) {
    score += WEIGHTS.user_velocity_24h_gt20;
    weights_applied.push('user_velocity_24h_gt20');
  }

  // Content signals
  if (!content.ocr_heuristic_valid) {
    score += WEIGHTS.ocr_heuristic_invalid;
    weights_applied.push('ocr_heuristic_invalid');
  }

  if (content.ocr_amount_anomaly !== 'normal') {
    score += WEIGHTS.ocr_amount_anomaly;
    weights_applied.push('ocr_amount_anomaly');
  }

  if (content.ocr_date_anomaly === 'future_date') {
    score += WEIGHTS.ocr_date_future;
    weights_applied.push('ocr_date_future');
  } else if (content.ocr_date_anomaly === 'old_transaction') {
    score += WEIGHTS.ocr_date_old;
    weights_applied.push('ocr_date_old');
  }

  if (!content.institution_known) {
    score += WEIGHTS.institution_unknown;
    weights_applied.push('institution_unknown');
  }

  // Clamp score to [0, 1]
  score = Math.min(1, Math.max(0, score));

  return {
    fraud_score: score,
    rule_version: RULE_VERSION,
    signals: {
      behavioral,
      content,
      weights_applied,
    },
  };
}