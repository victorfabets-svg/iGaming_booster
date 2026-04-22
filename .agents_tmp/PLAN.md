# 1. OBJECTIVE
Eliminate DB client leaks by enforcing automatic client lifecycle management.

---

# 2. CONTEXT SUMMARY

**Current state:**
- ✅ Pool protection exists (max 20 clients)
- ✅ Release wrapper exists (tracks counter)
- ✅ Circuit breaker exists

**New problem to solve:**
- ❌ Manual `client.release()` still required - risk of leak persists

**Architecture Rule:**
- `shared/` MUST NOT depend on `apps/`

---

# 3. APPROACH OVERVIEW

1. **Introduce `runWithClient()` wrapper** - Auto acquire + auto release
2. **Replace manual usage** - Update all code using `getClient()` to use wrapper
3. **Optional safeguard** - Deprecate `getClient()` to prevent regression

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Create runWithClient Wrapper

**Goal:** Create auto-acquire + auto-release wrapper function

**Method:** Add to `shared/database/connection.ts`:

```typescript
/**
 * Execute a function with a database client.
 * Automatically acquires a client from the pool and releases it when done.
 * This eliminates the risk of client leaks from manual release() calls.
 * 
 * @param fn - Function that receives the client and returns a promise
 * @returns The result of the function
 */
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

**Reference:** `shared/database/connection.ts`

---

## Step 2 — Find All getClient() Usage

**Goal:** Identify all code that needs to be migrated

**Method:** Search for all usages:

```bash
grep -r "getClient()" --include="*.ts" .
```

**Important:** Only migrate cases where `client` is used **locally within the same block**. 
If `client` is passed to external functions or escapes the scope, refactor first before migrating.

---

## Step 3 — Replace Manual Usage Pattern (Carefully)

**Goal:** Migrate code to use `runWithClient()` while preserving return values

**Method:** For each file found in Step 2, apply **only when client usage is local**:

Replace pattern:
```typescript
// BEFORE - manual lifecycle
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
// AFTER - automatic lifecycle with return value preserved
const result = await runWithClient(async (client) => {
  return await doSomething(client);
});
```

**CRITICAL:** If code returns the client or passes it to another function that might hold it, DO NOT replace directly. Refactor the caller instead.

---

## Step 4 — Deprecate getClient() (Safe Approach)

**Goal:** Warn future developers without breaking existing code

**Method:** Add JSDoc deprecation to `getClient()`:

```typescript
/**
 * @deprecated Use runWithClient() instead to prevent client leaks.
 * This function will be removed in a future version.
 * 
 * @throws Error if database is not initialized
 */
export async function getClient(): Promise<pg.PoolClient> {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  
  return acquireClient();
}
```

**Important:** Do NOT throw an error in getClient() yet - this would break:
- Worker processes
- Internal libraries
- Existing transactional flows

The deprecation warning is sufficient for now.

---

# 5. TESTING AND VALIDATION

**Manual test scenarios:**

1. **Client released on error:**
   - Throw an error inside the function
   - Verify client is still released (counter returns to baseline)

2. **Return value preserved:**
   - Return a value from inside runWithClient
   - Verify the value is correctly returned to the caller

3. **Multiple operations:**
   - Run multiple concurrent `runWithClient()` calls
   - Verify no client leaks

4. **Active clients return to baseline:**
   - Run several operations
   - After all complete, verify `activeDbClients` is 0

**Validation criteria:**
- ✅ Zero manual release() usage in application code
- ✅ Zero possible client leaks (auto-release in finally)
- ✅ Return values are preserved through wrapper
- ✅ Unified DB access pattern across codebase
