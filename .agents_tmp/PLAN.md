# 1. OBJECTIVE
Fix final logging schema mismatch (`context` → `module`) to fully comply with global observability contract.

---

# 2. CONTEXT SUMMARY

**Current issue:**
- ❌ Log field `context` is being used in some places
- ✅ Global standard requires `module` field

**Impact:**
- Breaks schema consistency
- Affects log parsing and dashboards
- Inconsistent observability data

**Architecture Rule:**
- `shared/` MUST use consistent logging schema

---

# 3. APPROACH OVERVIEW

1. **Replace incorrect field** - Change `context` to `module` in database layer
2. **Apply correct schema** - Ensure full compliance with global log format
3. **Scan for residuals** - Check for any remaining `context:` usage in DB layer

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Replace Incorrect Field in getClient()

**Goal:** Fix logging schema in database connection

**Method:** Update `getClient()` in `shared/database/connection.ts`:

Replace:
```typescript
const logger = createLogger({ module: 'db-connection' });

// ... later in the function:
logger.error({
  event: 'unsafe_db_usage_detected',
  function: 'getClient',
  stack: new Error().stack,
  timestamp: new Date().toISOString()
});
```

With:
```typescript
const logger = createLogger({ module: 'database' });

// ... later in the function:
logger.error({
  event: 'unsafe_db_usage_detected',
  module: 'database',
  function: 'getClient',
  message: 'getClient() called - use runWithClient() or withTransaction() instead',
  strict_mode: process.env.STRICT_DB,
  ...(process.env.STRICT_DB === 'warn' && {
    stack: new Error().stack
  })
});
```

**Reference:** `shared/database/connection.ts`

---

## Step 2 — Replace Incorrect Field in acquireClient()

**Goal:** Ensure pool exhaustion logs also use correct schema

**Method:** Update logging in `acquireClient()` function:

Replace:
```typescript
console.log(JSON.stringify({
  event: 'db_pool_exhausted',
  active_clients: activeDbClients,
  max_clients: MAX_DB_CLIENTS
}));
```

With:
```typescript
const logger = createLogger({ module: 'database' });

logger.error({
  event: 'db_pool_exhausted',
  module: 'database',
  message: 'Database pool exhausted - too many concurrent connections',
  active_clients: activeDbClients,
  max_clients: MAX_DB_CLIENTS
});
```

**Reference:** `shared/database/connection.ts`

---

## Step 3 — Ensure Full Schema Compliance

**Goal:** Verify all DB layer logs follow global observability contract

**Method:** Ensure all log calls use this structure:

```typescript
logger.error({
  event: '<event-name>',
  module: 'database',
  message: '<human-readable-message>',
  // ... additional context fields
});
```

**Key points:**
- Always use `module: 'database'` (not `context`)
- Always include `message` for human readability
- Include relevant context (function name, parameters, etc.)
- Conditionally include `stack` only in warn/strict modes

---

## Step 4 — Scan for Residual Issues

**Goal:** Ensure no remaining misuse of `context` field in DB layer

**Method:** Search for any remaining occurrences:

```bash
# Check for context: usage in database layer
grep -r "context:" --include="*.ts" shared/database/

# Also check apps that might import from shared
grep -r "context:" --include="*.ts" apps/api/src/server/utils/ | grep -i db
```

If any results found, update them to use `module` instead.

---

# 5. TESTING AND VALIDATION

**Manual test scenarios:**

1. **Trigger getClient() usage:**
   - Call any function that uses getClient()
   - Check log output

2. **Verify log fields:**
   - [ ] `event` field present
   - [ ] `module` field present (NOT `context`)
   - [ ] `message` field present
   - [ ] `stack` present only in STRICT_DB=warn mode

3. **Check pool exhaustion:**
   - Simulate max concurrent connections
   - Verify log uses correct schema

**Validation criteria:**
- ✅ Zero usage of `context` field in DB layer
- ✅ Full compliance with global log schema
- ✅ Observability pipeline consistent
- ✅ All tests pass

---

# 6. SUCCESS CRITERIA

- ✅ Zero usage of `context` field in database layer logs
- ✅ All logs use `module: 'database'` format
- ✅ Full compliance with global observability contract
- ✅ Consistent log parsing and dashboard behavior
