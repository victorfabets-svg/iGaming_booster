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

/**
 * Custom error for DB pool exhaustion
 * Used when too many concurrent DB clients are active
 */
export class DbPoolExhaustedError extends Error {
  constructor() {
    super('DB_POOL_EXHAUSTED');
    this.name = 'DB_POOL_EXHAUSTED';
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

// DB Pool Protection
let activeDbClients = 0;
const MAX_DB_CLIENTS = 20;

/**
 * Check if DB pool is exhausted (too many concurrent clients)
 */
export function isDbPoolExhausted(): boolean {
  return activeDbClients >= MAX_DB_CLIENTS;
}

/**
 * Get number of active DB clients (for monitoring)
 */
export function getActiveDbClients(): number {
  return activeDbClients;
}

/**
 * Increment active DB client counter
 * Returns false if limit reached, caller should not proceed
 */
export function incrementDbClients(): boolean {
  if (activeDbClients >= MAX_DB_CLIENTS) {
    return false;
  }
  activeDbClients++;
  return true;
}

/**
 * Decrement active DB client counter
 */
export function decrementDbClients(): void {
  activeDbClients = Math.max(0, activeDbClients - 1);
}