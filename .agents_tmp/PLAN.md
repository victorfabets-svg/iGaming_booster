# 1. OBJECTIVE
Add protection against DB pool exhaustion by limiting concurrent DB clients (in addition to existing circuit breaker).

---

# 2. CONTEXT SUMMARY

**Current protections:**
- ✅ Circuit breaker (5 failures → fast fail)
- ✅ HTTP-level concurrency control (100 max requests)
- ✅ Request timeout (10s)

**New problem to solve:**
- ❌ DB pool can still be exhausted by too many `connect()` calls → pool starvation

**Architecture Rule:**
- `shared/` MUST NOT depend on `apps/`

**Solution:**
- Track active DB clients in shared layer
- Enforce max concurrent clients (20)
- API layer handles error response mapping

---

# 3. APPROACH OVERVIEW

**Part A - Circuit Breaker (from previous plan):**
1. Circuit breaker module in shared layer (`shared/database/db-circuit.ts`)
2. Apply circuit check in DB wrapper
3. Handle in API layer (503 response)
4. Expose in health endpoint

**Part B - DB Pool Protection (new):**
1. Track active DB clients with counter
2. Enforce max concurrent clients (20)
3. Handle in API layer (503 response)

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Create Circuit Breaker in Shared Layer

**Goal:** Create circuit breaker module in shared layer (not apps/)

**Method:** Create new file `shared/database/db-circuit.ts`:

```typescript
/**
 * Custom error for circuit breaker open state
 * Used to distinguish circuit open errors from other DB errors
 */
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

let failures = 0;
let circuitOpen = false;
let lastFailureTime = 0;

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 10000;

export function isCircuitOpen(): boolean {
  if (!circuitOpen) return false;

  const now = Date.now();

  if (now - lastFailureTime > COOLDOWN_MS) {
    circuitOpen = false;
    failures = 0;
    return false;
  }

  return true;
}

export function recordFailure(): void {
  failures++;
  lastFailureTime = Date.now();

  if (failures >= FAILURE_THRESHOLD) {
    circuitOpen = true;
  }
}

export function recordSuccess(): void {
  failures = 0;
}
```

**Reference:** `shared/database/db-circuit.ts` (new file)

---

## Step 2 — Wrap Database Calls in Shared Layer

**Goal:** Apply circuit breaker + pool protection to DB operations in shared layer

**Method:** Update `shared/database/connection.ts`:

1. Add counter variables and import circuit breaker + pool exhaustion error:
```typescript
import { isCircuitOpen, recordFailure, recordSuccess, CircuitOpenError, DbPoolExhaustedError } from './db-circuit';

let activeDbClients = 0;
const MAX_DB_CLIENTS = 20;
```

2. Wrap `db.query()`:
```typescript
export const db = {
  query: async <T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }> => {
    if (isCircuitOpen()) {
      throw new CircuitOpenError();
    }
    
    if (!_db) {
      throw new Error('Database not initialized');
    }
    
    try {
      const result = await _db.query(text, params);
      recordSuccess();
      return { rows: result.rows };
    } catch (error) {
      recordFailure();
      throw error;
    }
  },
  
  connect: acquireClient,
};
```

3. Create shared `acquireClient()` function with leak + double-release protection:
```typescript
/**
 * Shared function to acquire a DB client with circuit breaker + pool protection.
 * Used by both db.connect() and getClient().
 */
async function acquireClient(): Promise<pg.PoolClient> {
  if (isCircuitOpen()) {
    throw new CircuitOpenError();
  }

  if (activeDbClients >= MAX_DB_CLIENTS) {
    // Log for observability before throwing
    console.log(JSON.stringify({
      event: 'db_pool_exhausted',
      active_clients: activeDbClients,
      max_clients: MAX_DB_CLIENTS
    }));
    
    throw new DbPoolExhaustedError();
  }

  activeDbClients++;

  try {
    const client = await _db!.connect();

    const originalRelease = client.release.bind(client);
    let released = false;

    // Wrap release to:
    // 1. Track when client is returned to pool
    // 2. Prevent double-release bugs
    // 3. Prevent leak if developer forgets to call release()
    client.release = () => {
      if (released) {
        return; // Prevent double-release
      }
      
      released = true;
      activeDbClients = Math.max(0, activeDbClients - 1);

      return originalRelease();
    };

    return client;
  } catch (err) {
    activeDbClients = Math.max(0, activeDbClients - 1);
    throw err;
  }
}
```

4. Use the shared function in `getClient()`:
```typescript
export async function getClient(): Promise<pg.PoolClient> {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  
  return acquireClient();
}
```

**Reference:** `shared/database/connection.ts`

---

## Step 3 — Handle Circuit Open + DB Pool Exhaustion in API Layer

**Goal:** Map both circuit open and pool exhaustion errors to proper 503 responses

**Method:** Update `apps/api/src/server/app.ts`:

1. Import both error classes:
```typescript
import { CircuitOpenError, DbPoolExhaustedError } from '@shared/database/db-circuit';
```

2. In setErrorHandler, check for both errors using instanceof:
```typescript
app.setErrorHandler((err, request, reply) => {
  // Fast fail for circuit open
  if (err instanceof CircuitOpenError) {
    return reply.status(503).send({
      success: false,
      data: null,
      error: {
        message: 'Service unavailable',
        code: 'CIRCUIT_OPEN'
      }
    });
  }
  
  // Fast fail for DB pool exhaustion
  if (err instanceof DbPoolExhaustedError) {
    return reply.status(503).send({
      success: false,
      data: null,
      error: {
        message: 'Database overloaded',
        code: 'DB_POOL_EXHAUSTED'
      }
    });
  }
  
  // ... existing error handling
});
```

**Reference:** `apps/api/src/server/app.ts`

---

## Step 4 — Expose Circuit State in Health Endpoint

**Goal:** Allow monitoring to query circuit state

**Method:** Update health endpoint in `apps/api/src/server/app.ts`:

1. Import circuit state using project alias:
```typescript
import { isCircuitOpen } from '@shared/database/db-circuit';
```

2. Add circuit state to response:
```typescript
app.get('/health/db', async (req, reply) => {
  // ... existing code
  
  payload.circuitOpen = isCircuitOpen();
  
  return reply.send(payload);
});
```

**Reference:** `apps/api/src/server/app.ts`

---

# 5. TESTING AND VALIDATION

## Part A - Circuit Breaker Tests

**Manual test scenarios:**

1. **Circuit opens after threshold:**
   - Simulate 5 consecutive DB failures
   - Verify circuit state is "open"

2. **Fast fail behavior:**
   - When circuit is open, requests should fail immediately (< 50ms)
   - Response: 503 status with `CIRCUIT_OPEN` error code

3. **Auto-recovery:**
   - After cooldown period (10s), verify circuit closes
   - Next request should proceed normally

**Success criteria (Circuit Breaker):**
- ✅ No layer violation - shared/ does NOT depend on apps/
- ✅ Fast fail - requests fail in < 50ms when circuit is open
- ✅ Automatic recovery - circuit recloses after cooldown

---

## Part B - DB Pool Protection Tests

**Manual test scenarios:**

1. **Pool exhaustion protection:**
   - Simulate many concurrent DB connections
   - After 20 concurrent connections, next requests should fail fast

2. **Fast fail behavior:**
   - When pool is exhausted, requests should fail immediately
   - Response: 503 status with `DB_POOL_EXHAUSTED` error code

3. **Client release tracking:**
   - Verify counter decrements when client.release() is called
   - Verify counter handles errors correctly (decrements on failure)

**Success criteria (DB Pool Protection):**
- ✅ No DB pool exhaustion - hard limit of 20 concurrent clients
- ✅ Fast fail - requests fail immediately when pool is saturated
- ✅ Graceful degradation - returns 503 instead of hanging

---

## Overall Success Criteria

- ✅ No layer violation (shared/ isolated)
- ✅ Circuit breaker works (fast fail + auto-recovery)
- ✅ DB pool protection works (max 20 clients)
- ✅ Both return 503 with appropriate error codes
