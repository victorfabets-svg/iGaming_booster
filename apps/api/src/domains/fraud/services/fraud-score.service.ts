import * as crypto from 'crypto';

export interface FraudScoreResult {
  score: number;
  signals: Record<string, unknown>;
}

/**
 * Fraud Scoring Service
 * Generates deterministic fraud score based on OCR and heuristic results
 * Can be adjusted by risk score modifier and payment signals
 */
export function calculateFraudScore(
  ocrResult: { amount: number; date: string; institution: string; identifier?: string | null },
  heuristicResult: { is_valid: boolean; issues: string[] },
  riskScoreModifier: number = 0,
  paymentModifier: number = 0
): FraudScoreResult {
  const signals: Record<string, unknown> = {};

  // Start with a base score
  let score = 1.0;

  // Signal: Heuristic validation passed
  signals.heuristic_valid = heuristicResult.is_valid;
  if (heuristicResult.is_valid) {
    score -= 0.1; // Good - slight reduction
  } else {
    score -= 0.4; // Bad - significant reduction
    signals.heuristic_issues = heuristicResult.issues;
  }

  // Signal: Amount analysis
  signals.amount = ocrResult.amount;
  if (ocrResult.amount < 1) {
    score -= 0.3; // Suspiciously low amount
    signals.amount_signal = 'too_low';
  } else if (ocrResult.amount > 10000) {
    score -= 0.2; // High value transaction
    signals.amount_signal = 'high_value';
  } else {
    signals.amount_signal = 'normal';
  }

  // Signal: Date analysis
  signals.date = ocrResult.date;
  const txDate = new Date(ocrResult.date);
  const daysAgo = Math.floor((Date.now() - txDate.getTime()) / (1000 * 60 * 60 * 24));
  signals.days_ago = daysAgo;
  
  if (daysAgo > 90) {
    score -= 0.15; // Old transaction
    signals.date_signal = 'old_transaction';
  } else if (daysAgo < 0) {
    score -= 0.3; // Future date - suspicious
    signals.date_signal = 'future_date';
  } else {
    signals.date_signal = 'normal';
  }

  // Signal: Institution
  signals.institution = ocrResult.institution;
  const knownInstitutions = ['Bank of America', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One'];
  if (knownInstitutions.includes(ocrResult.institution)) {
    score -= 0.05; // Known institution - slight bonus
    signals.institution_signal = 'known';
  } else {
    score -= 0.15; // Unknown institution
    signals.institution_signal = 'unknown';
  }

  // Signal: Identifier presence
  signals.has_identifier = !!ocrResult.identifier;
  if (ocrResult.identifier) {
    // Generate deterministic score based on identifier hash
    const idHash = crypto.createHash('sha256').update(ocrResult.identifier).digest();
    const idMod = idHash.readUInt16BE(0) % 100;
    signals.identifier_quality = idMod > 50 ? 'good' : 'weak';
    score -= 0.05;
  } else {
    score -= 0.1;
    signals.identifier_quality = 'missing';
  }

  // Signal: Risk modifier from behavior analysis
  if (riskScoreModifier > 0) {
    score -= riskScoreModifier;
    signals.risk_score_modifier = riskScoreModifier;
    signals.risk_signals_applied = true;
  }

  // Signal: Payment identifier modifier
  if (paymentModifier !== 0) {
    score += paymentModifier; // Positive modifier adds to score, negative subtracts
    signals.payment_modifier = paymentModifier;
    signals.payment_signals_applied = true;
  }

  // Ensure score is between 0 and 1
  score = Math.max(0, Math.min(1, score));

  // Round to 2 decimal places
  score = Math.round(score * 100) / 100;

  signals.final_score = score;

  return { score, signals };
}