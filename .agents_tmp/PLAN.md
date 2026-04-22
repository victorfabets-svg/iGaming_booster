# 1. OBJECTIVE
Add DB circuit breaker without breaking shared layer boundaries.

---

# 2. CONTEXT SUMMARY

**Critical flaw in previous plan:**
- ❌ `shared/database` importing from `apps/api` → breaks architecture (SSOT violation)

**Architecture Rule:**
- `shared/` MUST NOT depend on `apps/`

**Solution:**
- Move circuit breaker to shared layer (`shared/database/db-circuit.ts`)
- Apply circuit check inside DB wrapper in shared layer
- API layer only handles response mapping (503)

---

# 3. APPROACH OVERVIEW

1. **Move circuit breaker to shared layer** - `shared/database/db-circuit.ts`
2. **Wrap DB operations in shared layer** - Apply circuit check in `shared/database/connection.ts`
3. **Handle in API layer** - Map `CIRCUIT_OPEN` error to 503 response
4. **Expose in health endpoint** - Show circuit state in `/health/db`

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

**Goal:** Apply circuit breaker to DB operations in shared layer

**Method:** Update `shared/database/connection.ts`:

1. Import circuit breaker functions and error class:
```typescript
import { isCircuitOpen, recordFailure, recordSuccess, CircuitOpenError } from './db-circuit';
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
  // ... similar for connect() method
};
```

**Reference:** `shared/database/connection.ts`

---

## Step 3 — Handle Circuit Open in API Layer

**Goal:** Map circuit open error to proper 503 response

**Method:** Update `apps/api/src/server/app.ts`:

1. Import circuit open error class using project alias:
```typescript
import { CircuitOpenError } from '@shared/database/db-circuit';
```

2. In setErrorHandler, check for circuit open using instanceof:
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

**Success criteria:**
- ✅ No layer violation - shared/ does NOT depend on apps/
- ✅ Fast fail - requests fail in < 50ms when circuit is open
- ✅ Automatic recovery - circuit recloses after cooldown
