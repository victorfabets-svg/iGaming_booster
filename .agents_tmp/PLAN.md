# 1. OBJECTIVE

Add basic rate limiting to critical API endpoints (`/register` and `/proofs`) using an in-memory rate limiter, applied per IP address, without creating new branches.

---

# 2. CONTEXT SUMMARY

**Current branch:** `feature/backend-sprint-5-7-validation`

**System:**
- Framework: Fastify (based on imports in route files)
- Routes location: `apps/api/src/server/routes/`
- Response utility: `apps/api/src/server/utils/response.ts`
- Validation already implemented ✅
- API contract already implemented ✅
- Rate limiting missing ❌

**Key files:**
- `/apps/api/src/server/routes/auth.ts` - contains `/register` endpoint
- `/apps/api/src/server/routes/proofs.ts` - contains `/proofs` endpoint
- No existing rate limiter in `apps/api/src/server/utils/`

---

# 3. APPROACH OVERVIEW

Implement a simple in-memory rate limiter that:
- Tracks requests per IP address using a Map
- Applies sliding window algorithm (filters timestamps within window)
- Returns `false` when limit exceeded, `true` otherwise
- Must run BEFORE validation and business logic

**Endpoints to protect:**
- `/register` - stricter limit (5 requests per minute) due to registration sensitivity
- `/proofs` - more permissive limit (10 requests per minute) for file uploads

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Create Rate Limiter Utility

**Goal:** Create a reusable rate limiting function

**Method:** Create new file `apps/api/src/server/utils/rate-limit.ts` with:
- A Map to store IP -> timestamps array
- Export function `rateLimit(key, limit, windowMs)` that:
  - Gets current timestamp
  - Creates entry if key doesn't exist
  - Filters out timestamps older than window
  - Returns false if at limit
  - Adds current timestamp and returns true if allowed

**Reference:** `apps/api/src/server/utils/rate-limit.ts` (new file)

```typescript
const store = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (!store.has(key)) {
    store.set(key, []);
  }

  const timestamps = store.get(key)!.filter(t => now - t < windowMs);

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return true;
}
```

---

## Step 2 — Apply Rate Limiting to /register

**Goal:** Protect registration endpoint from abuse

**Method:** 
1. Import `rateLimit` from `../utils/rate-limit`
2. At the START of the route handler (before any validation), extract IP from `request.ip`
3. Call `rateLimit(req.ip, 5, 60000)` - 5 requests per minute
4. If returns false, call `fail(reply, 'Too many requests', 'RATE_LIMIT')` and return

**Reference:** `apps/api/src/server/routes/auth.ts`

**Code to add (at start of route handler, before requireFields):**
```typescript
const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
const allowed = rateLimit(clientIp, 5, 60000);

if (!allowed) {
  return fail(reply, 'Too many requests', 'RATE_LIMIT');
}
```

---

## Step 3 — Apply Rate Limiting to /proofs

**Goal:** Protect proof submission endpoint from abuse

**Method:**
1. Import `rateLimit` from `../../utils/rate-limit` (note: different relative path)
2. At the START of the route handler (before auth check), extract IP
3. Call `rateLimit(req.ip, 10, 60000)` - 10 requests per minute
4. If returns false, call `fail(reply, 'Too many requests', 'RATE_LIMIT')` and return

**Reference:** `apps/api/src/server/routes/proofs.ts`

**Code to add (at start of route handler, before user_id check):**
```typescript
const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
const allowed = rateLimit(clientIp, 10, 60000);

if (!allowed) {
  return fail(reply, 'Too many requests', 'RATE_LIMIT');
}
```

---

## Step 4 — Verify Execution Order

**Goal:** Ensure rate limiting runs before validation and business logic

**Method:** Confirm in both files that rate limit check is the FIRST code executed in the route handler, BEFORE:
- Field validation
- Auth middleware results processing
- Business logic

---

# 5. TESTING AND VALIDATION

**Manual test approach:**
1. Start the API server
2. Make rapid requests to `/register` endpoint (more than 5 in 1 minute) → should get RATE_LIMIT error after 5th request
3. Wait 1 minute → should allow again
4. Make rapid requests to `/proofs` endpoint with valid auth (more than 10 in 1 minute) → should get RATE_LIMIT error after 10th request
5. Normal usage within limits → should work normally

**Expected behavior:**
- RATE_LIMIT error response format:
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "message": "Too many requests",
      "code": "RATE_LIMIT"
    }
  }
  ```

**Success criteria:**
- [ ] `/register` endpoint returns RATE_LIMIT after 5 requests in 1 minute window
- [ ] `/proofs` endpoint returns RATE_LIMIT after 10 requests in 1 minute window  
- [ ] Error response has consistent `code: "RATE_LIMIT"`
- [ ] Rate limiting runs before validation (no validation errors shown when rate limited)
