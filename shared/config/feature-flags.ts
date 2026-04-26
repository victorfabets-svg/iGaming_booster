/**
 * Runtime feature flags. Read from environment each call — no cache, no
 * deploy needed to flip. Kept simple on purpose: dev-side toggle, not a
 * full LaunchDarkly. For production rollouts use the same convention,
 * just set env at the orchestrator layer.
 *
 * Boolean parse: 'true' / '1' / 'on' / 'yes' (case-insensitive) → true.
 * Anything else (incl. unset / empty) → false.
 */

export type FlagName =
  | 'FRAUD_V1_ENABLED'
  | 'STRICT_MODE'
  | 'T3_SHORT_CIRCUIT_ENABLED';

const TRUE_VALUES = new Set(['true', '1', 'on', 'yes']);

interface FlagSpec {
  envVar: string;
  defaultValue: boolean;
}

const FLAGS: Record<FlagName, FlagSpec> = {
  FRAUD_V1_ENABLED:       { envVar: 'FRAUD_V1_ENABLED',       defaultValue: true },
  STRICT_MODE:          { envVar: 'STRICT_MODE',          defaultValue: false },
  T3_SHORT_CIRCUIT_ENABLED: { envVar: 'T3_SHORT_CIRCUIT_ENABLED', defaultValue: false },
};

export function getFlag(name: FlagName): boolean {
  const spec = FLAGS[name];
  const raw = process.env[spec.envVar];
  if (raw === undefined || raw === '') return spec.defaultValue;
  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

// Legacy stubs — kept for consumers of the old featureFlags class API.
// Rewards and validation use-cases (out of T6 scope) import these directly.
export function isRewardsEnabled(): boolean {
  return getFlag('FRAUD_V1_ENABLED'); // legacy: re-use fraud flag as rewards proxy
}

export function isValidationEnabled(): boolean {
  return getFlag('FRAUD_V1_ENABLED'); // legacy: re-use fraud flag as validation proxy
}

// Stub for old featureFlags.logAllFlags() consumer in index.ts
// (no-op — hot-toggle means flags can change at runtime)
export const featureFlags = {
  logAllFlags: () => {
    console.log('📋 Feature Flags (runtime):');
    console.log(`   ${getFlag('FRAUD_V1_ENABLED') ? '✅' : '❌'} FRAUD_V1_ENABLED: ${getFlag('FRAUD_V1_ENABLED')}`);
    console.log(`   ${getFlag('STRICT_MODE') ? '✅' : '❌'} STRICT_MODE: ${getFlag('STRICT_MODE')}`);
    console.log(`   ${getFlag('T3_SHORT_CIRCUIT_ENABLED') ? '✅' : '❌'} T3_SHORT_CIRCUIT_ENABLED: ${getFlag('T3_SHORT_CIRCUIT_ENABLED')}`);
    // legacy stubs for out-of-scope consumers
    console.log(`   ${isRewardsEnabled() ? '✅' : '❌'} ENABLE_REWARDS: ${isRewardsEnabled()}`);
    console.log(`   ${isValidationEnabled() ? '✅' : '❌'} ENABLE_VALIDATION: ${isValidationEnabled()}`);
  }
};