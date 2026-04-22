/**
 * DB Circuit Breaker
 * 
 * Prevents cascading failures by fast-failing when DB is unhealthy.
 * Lives in shared layer to protect all database operations.
 */

// Custom error for circuit breaker open state
export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit is open');
    this.name = 'CIRCUIT_OPEN';
  }
}

// Circuit state
let failures = 0;
let circuitOpen = false;
let lastFailureTime = 0;

// Config
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 10000;

/**
 * Check if circuit is open
 * Returns false if circuit closed or cooldown period has elapsed
 */
export function isCircuitOpen(): boolean {
  if (!circuitOpen) return false;

  const now = Date.now();

  // Auto-reset after cooldown
  if (now - lastFailureTime > COOLDOWN_MS) {
    circuitOpen = false;
    failures = 0;
    return false;
  }

  return true;
}

/**
 * Record a failure - opens circuit after threshold
 */
export function recordFailure(): void {
  failures++;
  lastFailureTime = Date.now();

  if (failures >= FAILURE_THRESHOLD) {
    circuitOpen = true;
  }
}

/**
 * Record a success - resets failure counter
 */
export function recordSuccess(): void {
  failures = 0;
}

/**
 * Get circuit state for monitoring
 */
export function getCircuitState(): { open: boolean; failures: number } {
  return {
    open: circuitOpen,
    failures
  };
}