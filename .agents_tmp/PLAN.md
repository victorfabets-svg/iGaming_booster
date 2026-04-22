# 1. OBJECTIVE
Enforce safe DB usage and eliminate client leaks permanently.

---

# 2. CONTEXT SUMMARY

**Current state:**
- ✅ `runWithClient` exists (auto acquire + release)
- ✅ `withTransaction` exists
- ✅ Circuit breaker exists
- ✅ Pool protection exists (max 20 clients)
- ✅ Logging for unsafe usage exists

**New problem to solve:**
- ❌ `getClient()` is still usable and can cause leaks
- ❌ Developers may still misuse it despite warnings

**Architecture Rule:**
- `shared/` MUST NOT depend on `apps/`

---

# 3. APPROACH OVERVIEW

1. **Add documentation banner** - Clear guidelines at top of connection.ts
2. **Keep existing wrappers** - `runWithClient` and `withTransaction` work correctly
3. **Harden getClient** - Logging + optional blocking via STRICT_DB flag
4. **Audit codebase** - Find all usages of getClient()
5. **Migrate safely** - Replace only when client usage is local
6. **Progressive rollout** - Dev → Staging → Production
7. **Remove completely** - Delete getClient() after clean logs

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Add Header Banner

**Goal:** Document safe usage patterns prominently

**Method:** Add banner at top of `shared/database/connection.ts`:

```typescript
/**
 * ============================================================================
 * ⚠️ DATABASE CONNECTION - SAFE USAGE PATTERNS
 * ============================================================================
 * 
 * Use ONLY these patterns for database access:
 * 
 * 1. runWithClient(fn)     - For single queries with auto-release
 * 2. withTransaction(fn)   - For transactional operations
 * 3. db.query()            - For simple queries (uses internal pool)
 * 
 * DO NOT use:
 * - getClient()            - Deprecated, will be removed
 * - client.query() directly outside wrappers
 * 
 * Example - CORRECT:
 *   const result = await runWithClient(async (client) => {
 *     return await client.query('SELECT * FROM users WHERE id = $1', [id]);
 *   });
 * 
 * Example - INCORRECT (causes leaks):
 *   const client = await getClient();
 *   try { await client.query('...'); } 
 *   finally { client.release(); }
 * 
 * ============================================================================
 */
```

**Reference:** `shared/database/connection.ts`

---

## Step 2 — runWithClient (Already Exists - DO NOT MODIFY)

The `runWithClient()` wrapper is already implemented. Ensure it remains unchanged:

```typescript
export async function runWithClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await acquireClient();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
```

---

## Step 3 — Harden getClient()

**Goal:** Add logging and optional blocking

**Method:** Update `getClient()` in `shared/database/connection.ts`:

```typescript
import { createLogger } from '../observability/logger';

const logger = createLogger({ module: 'db-connection' });

/**
 * ⚠️ DEPRECATED - Use runWithClient() or withTransaction() instead.
 * 
 * This function will be removed in a future version.
 * 
 * @throws Error if database is not initialized
 * @deprecated
 */
export async function getClient(): Promise<pg.PoolClient> {
  // Log every usage for auditing
  logger.error({
    event: 'unsafe_db_usage_detected',
    function: 'getClient',
    stack: new Error().stack,
    timestamp: new Date().toISOString()
  });

  // Optional blocking via environment variable
  const STRICT_DB = process.env.STRICT_DB;
  
  if (STRICT_DB === 'true') {
    throw new Error('getClient() is disabled. Use runWithClient() or withTransaction() instead.');
  }

  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  return acquireClient();
}
```

**Reference:** `shared/database/connection.ts`

---

## Step 4 — Audit Codebase

**Goal:** Find all usages that need migration

**Method:** Search for patterns:

```bash
# Find all getClient() usages
grep -r "await getClient()" --include="*.ts" .

# Find all client.query usages (may indicate direct usage)
grep -r "client.query" --include="*.ts" . | grep -v node_modules
```

**Important:** Review each result to determine:
- Is `client` used locally within the same block?
- Or does it escape to external functions?

Only migrate local usage patterns.

---

## Step 5 — Migrate to runWithClient (CRITICAL)

**Goal:** Safely replace getClient() usage with runWithClient()

**Method:** For each file found in Step 4, apply **only when client usage is local**:

Replace:
```typescript
// BEFORE - manual lifecycle (unsafe)
const client = await getClient();
try {
  const result = await doSomething(client);
  return result;
} finally {
  client.release();
}
```

With:
```typescript
// AFTER - automatic lifecycle (safe)
const result = await runWithClient(async (client) => {
  return await doSomething(client);
});
```

**CRITICAL RULE:** If `client` is:
- Returned from the function
- Passed to another function that might store it
- Used beyond the immediate block

Then DO NOT replace directly. Refactor the caller first.

---

## Step 6 — Progressive Rollout

**Goal:** Safely enable enforcement across environments

| Environment | STRICT_DB Value | Behavior |
|-------------|-----------------|----------|
| development | undefined/false | Logs warning, continues working |
| staging | 'warn' | Logs with extra context, continues |
| production | 'true' | Throws error, blocks usage |

**Recommended rollout:**
1. Deploy with default (logs only)
2. Monitor logs for 1-2 days
3. Enable `STRICT_DB=warn` on staging
4. After migration complete, enable on production

---

## Step 7 — Remove getClient() Completely

**Goal:** Permanently eliminate unsafe pattern

**Method:** After logs show zero usage:

1. Remove the entire `getClient()` function:
```typescript
// DELETE THIS:
export async function getClient(): Promise<pg.PoolClient> { ... }
```

2. Update any remaining imports

3. Ensure all code uses `runWithClient()` or `withTransaction()`

**Warning:** This is irreversible. Ensure all usages have been migrated first.

---

# 5. TESTING AND VALIDATION

## Phase 1 - Default (No Flag)
- [ ] getClient() logs warning on every call
- [ ] Code continues to work
- [ ] Check logs for `unsafe_db_usage_detected`

## Phase 2 - Warning Mode (STRICT_DB=warn)
- [ ] More detailed logging visible
- [ ] Usage count visible in logs
- [ ] No code breakage

## Phase 3 - Strict Mode (STRICT_DB=true)
- [ ] getClient() throws error
- [ ] All code must use safe patterns
- [ ] Verify no production issues

## Phase 4 - Removal
- [ ] getClient() removed completely
- [ ] All imports updated
- [ ] No usage in codebase
- [ ] No client leaks possible

---

# 6. SUCCESS CRITERIA

- ✅ Zero `getClient()` usage in codebase
- ✅ Zero manual `client.release()` calls
- ✅ Zero possible client leaks
- ✅ Single, consistent DB access pattern (`runWithClient`)
- ✅ All tests pass
- ✅ Production monitoring shows no unsafe usage
