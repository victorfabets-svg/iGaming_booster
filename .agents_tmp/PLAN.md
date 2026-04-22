# 1. OBJECTIVE

Expose correlation ID in ALL logs automatically (no manual injection) using a centralized logger wrapper. Every log entry should automatically include `request_id` (for API requests) or `correlation_id` (for background processing) without developers needing to manually add it.

---

# 2. CONTEXT SUMMARY

**Current state:**
- Request ID middleware exists (`apps/api/src/server/middleware/request-id.ts`) ✅
- `request.requestId` is attached to requests ✅
- Some logs manually include `request_id` ⚠️
- Many `console.log` calls exist without tracing context ❌

**Problem:**
- Inconsistent logging - some have request_id, most don't
- Developers must remember to manually inject request_id
- Hard to trace issues in production

**Files with console.log (need migration):**
- `apps/api/src/server/routes/proofs.ts`
- `apps/api/src/server/utils/idempotency.ts`
- `apps/api/src/server/index.ts`
- `apps/api/src/domains/validation/application/createProofUseCase.ts`
- Plus other domain files

---

# 3. APPROACH OVERVIEW

1. **Create logger wrapper** - Simple logger that auto-injects context
2. **Bind logger to request** - Attach context-aware logger to request in middleware
3. **Replace console.log** - Migrate all raw console.log to use the centralized logger
4. **Worker context** - Create logger with correlation_id for background processing

The key insight: instead of passing request_id to every log call, bind it once to the logger instance.

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Create Logger Wrapper

**Goal:** Create centralized logger that auto-injects context

**Method:** Create new file `apps/api/src/server/utils/logger.ts`:
- Accept static context (e.g., request_id, correlation_id)
- Provide info/error/warn methods
- Always output JSON with timestamp

**Reference:** `apps/api/src/server/utils/logger.ts` (new file)

```typescript
/**
 * Centralized logger with automatic context injection.
 * All logs automatically include bound context (request_id, correlation_id, etc.)
 */
export interface Logger {
  info(data: Record<string, unknown>): void;
  error(data: Record<string, unknown>): void;
  warn(data: Record<string, unknown>): void;
  debug(data: Record<string, unknown>): void;
}

/**
 * Create a logger with bound context.
 * Context is automatically included in every log entry.
 * 
 * NOTE: timestamp is generated per-log, not per-logger (fixes timestamp drift)
 */
export function createLogger(context: Record<string, unknown> = {}): Logger {
  const boundContext = { ...context };

  const log = (level: string, data: Record<string, unknown>) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(), // Generate fresh timestamp per log
      level,
      ...boundContext,
      ...data
    }));
  };

  return {
    info: (data) => log('info', data),
    error: (data) => log('error', data),
    warn: (data) => log('warn', data),
    debug: (data) => log('debug', data),
  };
}

/**
 * Fastify request extension with logger
 */
export interface RequestWithLogger {
  logger: Logger;
  requestId?: string;
  ip?: string;
}

/**
 * Create logger from request - extracts requestId automatically
 */
export function createRequestLogger(request: RequestWithLogger): Logger {
  const requestId = request?.requestId || (request?.headers as any)?.['x-request-id'];
  return createLogger({ 
    request_id: requestId,
    ip: request?.ip || (request?.headers as any)?.['x-forwarded-for']
  });
}
```

---

## Step 2 — Bind Logger to Request in Middleware

**Goal:** Attach context-aware logger to every request automatically

**Method:** Update `apps/api/src/server/middleware/request-id.ts`:
- Import `createLogger`
- Create logger with request_id bound
- Attach to request object

**Reference:** `apps/api/src/server/middleware/request-id.ts`

**Code changes:**
```typescript
import { createLogger } from '../utils/logger';

// In preHandler hook, after setting requestId:
(request as any).logger = createLogger({
  request_id: requestId
});
```

---

## Step 3 — Replace console.log in Routes

**Goal:** Use logger with automatic context in route handlers

**Method:** Update `apps/api/src/server/routes/proofs.ts`:
- Import `createRequestLogger` or use `request.logger`
- Replace `console.log` with `request.logger.info()`

**Reference:** `apps/api/src/server/routes/proofs.ts`

**Code changes:**
```typescript
// Replace:
console.log(`[PROOF] Received file: ${filename}, size: ${fileBuffer.length} bytes, user: ${user_id}`);

// With:
request.logger.info({
  event: 'proof_received',
  filename,
  size: fileBuffer.length,
  user_id
});
```

---

## Step 4 — Replace console.log in Idempotency Utils

**Goal:** Use logger in idempotency utility functions

**Method:** Update `apps/api/src/server/utils/idempotency.ts`:
- Import `createLogger` with static context
- Replace console.error with logger.error

**Reference:** `apps/api/src/server/utils/idempotency.ts`

**Code changes:**
```typescript
// At top of file, create module logger
const logger = createLogger({ module: 'idempotency' });

// Replace console.error with:
logger.error({ event: 'idempotency_cleanup_executed', deleted_count: deleted, cutoff: cutoff.toISOString() });
```

---

## Step 5 — Replace console.log in API Entry Point

**Goal:** Use logger in server startup

**Method:** Update `apps/api/src/server/index.ts`:
- Replace console.log with logger

**Reference:** `apps/api/src/server/index.ts`

---

## Step 6 — Replace console.log in Domain Use Cases

**Goal:** Use logger in business logic with correlation context

**Method:** Update key domain files:
- `apps/api/src/domains/validation/application/createProofUseCase.ts`
- Other files that log during request processing

For use cases called from routes, they receive request context. For background processing, create logger with correlation_id.

**Reference:** Domain use case files

---

## Step 7 — Create Worker/Consumer Logger

**Goal:** Logger for background processing with correlation_id

**Method:** Create helper or update consumer files:
- Accept correlation_id from event
- Create logger with correlation_id bound

**Reference:** `shared/events/event-consumer.repository.ts`

**Code changes:**
```typescript
// In consumer processing:
const logger = createLogger({ correlation_id: event.correlation_id });
logger.info({ event: 'event_processed', event_type: event.event_type });
```

---

## Step 8 — Audit Log Integration

**Goal:** Audit logs also use centralized logger

**Method:** Update `shared/events/audit-log.ts`:
- Use createLogger with module context
- Include correlation_id when provided

**Reference:** `shared/events/audit-log.ts`

---

# 5. TESTING AND VALIDATION

**Manual test approach:**
1. Send API request to `/proofs`
2. Check server logs - should contain `request_id` automatically
3. Verify format is valid JSON with all fields
4. For background events - check worker logs contain `correlation_id`

**Expected log format:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "request_id": "abc-123",
  "event": "proof_received",
  "filename": "document.pdf",
  "size": 1024
}
```

**Success criteria:**
- [ ] All API route logs include request_id automatically
- [ ] All worker/consumer logs include correlation_id
- [ ] No raw console.log in application code (only node_modules)
- [ ] All logs are valid JSON
- [ ] Consistent log format across all modules
