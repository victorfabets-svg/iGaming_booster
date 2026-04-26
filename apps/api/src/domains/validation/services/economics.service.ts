import type { Decision } from './validation-rules.service';

export const ECONOMICS_VERSION = 'econ-v1.0.0';

export const COST_PER_PROOF_CENTAVOS = 100;

export const VALUE_BY_DECISION_CENTAVOS: Record<Decision, number> = {
  approved:      5000,
  rejected:         0,
  manual_review:    0,
};

export interface EconomicsRecord {
  cost_centavos: number;
  value_centavos: number;
  economics_version: string;
}

/**
 * Compute economics for a terminal decision. Pure function — no I/O, no random.
 * Cost is flat per proof; value is decision-driven via the constants table above.
 */
export function calculateEconomics(decision: Decision): EconomicsRecord {
  return {
    cost_centavos: COST_PER_PROOF_CENTAVOS,
    value_centavos: VALUE_BY_DECISION_CENTAVOS[decision],
    economics_version: ECONOMICS_VERSION,
  };
}