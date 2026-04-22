# 1. OBJECTIVE

Add request tracing (correlation ID) across API, events, and worker for end-to-end debugging. This enables correlating logs from a single user request across the entire system.

---

# 2. CONTEXT SUMMARY

**Current state:**
- Observability logs exist ✅ (via Fastify's `logger: true`)
- Audit logs exist ✅ (`shared/events/audit-log.ts`)
- Transactional outbox exists ✅ (`shared/events/transactional-outbox.ts`) with `correlation_id` field

**Problem:**
- No `x-request-id` header propagated from API requests
- Events get new random `correlation_id` instead of inheriting from request
- Cannot trace a single user flow from API → events → worker

**Key files:**
- `apps/api/src/server/app.ts` - Fastify app setup (needs middleware registration)
- `shared/events/transactional-outbox.ts` - Event creation (generates new correlation_id)
- `shared/events/audit-log.ts` - Audit logging (no correlation_id)
- `apps/api/src/server/routes/*.ts` - Route handlers (need to pass requestId)

---

# 3. APPROACH OVERVIEW

1. **Create request ID middleware** - Extract incoming `x-request-id` or generate new UUID
2. **Register in Fastify app** - Apply middleware to all requests
3. **Propagate to event creation** - Pass request ID to `insertEventInTransaction`
4. **Include in audit logs** - Add correlation_id to audit log metadata
5. **Update worker logs** - Use event's correlation_id in processing logs

The approach uses the existing `correlation_id` field in the events table and extends it to be tied to the original HTTP request.

---

# 4. IMPLEMENTATION STEPS

## Step 1 — Create Request ID Middleware

**Goal:** Create Fastify plugin to extract/generate request ID and attach to request

**Method:** Create new file `apps/api/src/server/middleware/request-id.ts`:
- Check for incoming `x-request-id` header
- Generate UUID if not present
- Attach to `request.requestId`
- Set response header

**Reference:** `apps/api/src/server/middleware/request-id.ts` (new file)

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Request ID middleware - generates or extracts x-request-id for tracing
 */
export async function requestIdMiddleware(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const incoming = request.headers['x-request-id'] as string | undefined;
    const requestId = incoming || randomUUID();

    // Attach to request for use in handlers
    (request as any).requestId = requestId;

    // Set response header
    reply.header('x-request-id', requestId);
  });
}
```

---

## Step 2 — Register Middleware in App

**Goal:** Apply request ID middleware to all routes

**Method:** Update `apps/api/src/server/app.ts`:
- Import `requestIdMiddleware`
- Register it BEFORE routes

**Reference:** `apps/api/src/server/app.ts`

**Code changes:**
```typescript
import { requestIdMiddleware } from './middleware/request-id';

// Register request ID middleware (before routes)
await app.register(requestIdMiddleware);

// ... existing route registrations
```

---

## Step 3 — Update Event Creation to Accept Correlation ID

**Goal:** Allow passing request ID to event creation instead of generating random one

**Method:** Update `shared/events/transactional-outbox.ts`:
- Modify `insertEventInTransaction` to accept optional `correlationId` parameter
- Use provided correlation_id if given, otherwise generate new UUID

**Reference:** `shared/events/transactional-outbox.ts`

**Code changes:**
```typescript
export async function insertEventInTransaction(
  client: any,
  event_type: string,
  payload: Record<string, any>,
  producer: string,
  version = 'v1',
  correlationId?: string // Add optional parameter
): Promise<void> {
  const event_id = randomUUID();
  const correlation_id = correlationId || randomUUID(); // Use provided or generate
  
  await client.query(
    `INSERT INTO events.events (id, event_type, version, producer, correlation_id, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [event_id, event_type, version, producer, correlation_id, JSON.stringify(payload)]
  );
}
```

---

## Step 4 — Update Audit Log to Include Correlation ID

**Goal:** Include request ID in audit log metadata

**Method:** Update `shared/events/audit-log.ts`:
- Add optional `correlationId` parameter to `auditLog`
- Include in metadata

**Reference:** `shared/events/audit-log.ts`

**Code changes:**
```typescript
export async function auditLog(
  userId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string
): Promise<void> {
  // Include correlation_id in metadata for traceability
  const fullMetadata = {
    ...metadata,
    ...(correlationId && { correlation_id: correlationId })
  };
  
  await db.query(
    `INSERT INTO audit.logs (user_id, action, metadata)
     VALUES ($1, $2, $3)`,
    [userId, action, JSON.stringify(fullMetadata)]
  );
}

// Update systemAuditLog similarly
export async function systemAuditLog(
  action: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string
): Promise<void> {
  return auditLog(null, action, metadata, correlationId);
}
```

---

## Step 5 — Update /register Route to Pass Request ID

**Goal:** Pass request ID to event creation and audit logging

**Method:** Update `apps/api/src/server/routes/auth.ts`:
- Extract `requestId` from request
- Pass to auditLog calls

**Reference:** `apps/api/src/server/routes/auth.ts`

**Code changes:**
```typescript
// In route handler, get requestId
const requestId = (request as any).requestId;

// Pass to auditLog
await auditLog(userId, 'user_registered', { email }, requestId);
```

---

## Step 6 — Update /proofs Route to Pass Request ID

**Goal:** Pass request ID to event creation and audit logging

**Method:** Update `apps/api/src/server/routes/proofs.ts`:
- Extract `requestId` from request
- Pass to auditLog calls

**Reference:** `apps/api/src/server/routes/proofs.ts`

**Code changes:**
```typescript
// In route handler, get requestId
const requestId = (request as any).requestId;

// Pass to auditLog
await auditLog(user_id, 'proof_submitted', { 
  proof_id: result.proof_id,
  filename,
  size: fileBuffer.length 
}, requestId);
```

---

## Step 7 — Update Worker Logs to Include Correlation ID

**Goal:** Log correlation ID when processing events for end-to-end tracing

**Method:** Update relevant consumer files to log with correlation_id:
- `apps/api/src/domains/validation/consumers/validation-aggregator.consumer.ts`
- Any other event consumers

**Reference:** Event consumer files

**Code changes:**
```typescript
// When processing event, include correlation_id in logs
console.log(JSON.stringify({
  event: 'validation_aggregated',
  correlation_id: event.correlation_id, // From the event itself
  proof_id: payload.proof_id,
  user_id: payload.user_id
}));
```

---

# 5. TESTING AND VALIDATION

**Manual test approach:**
1. Start API server and worker
2. Send request to `/register` without `x-request-id` → response contains new UUID in `x-request-id` header
3. Send request with custom `x-request-id: my-test-id` → same ID returned in response
4. Check database events table → `correlation_id` matches the request ID
5. Check audit logs → `correlation_id` in metadata matches
6. Check worker logs → contains same correlation_id

**Expected behavior:**
- Response always includes `x-request-id` header
- If client sends `x-request-id`, it's preserved (not regenerated)
- Events and audit logs contain same correlation_id
- Full trace from API → event → worker logs

**Success criteria:**
- [ ] All API responses include `x-request-id` header
- [ ] Events table stores correlation_id matching original request
- [ ] Audit logs include correlation_id in metadata
- [ ] Worker logs include correlation_id from events
- [ ] End-to-end trace is possible with single ID
