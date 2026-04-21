# 1. OBJECTIVE
Migrate from deprecated TypeScript path aliases (baseUrl + paths) to modern Node.js module resolution using package.json "imports" and TypeScript "NodeNext" module resolution.

# 2. CONTEXT SUMMARY
- Current tsconfig.base.json uses deprecated `baseUrl`, `paths`, and `moduleResolution: bundler`
- 22 TypeScript files use `@shared/` alias for imports
- Package name is "igaming-booster"
- Root package.json lacks `"type": "module"` and `"imports"` field
- Files affected: package.json, tsconfig.base.json, apps/api/tsconfig.json, apps/worker/tsconfig.json, and 22 source files

# 3. APPROACH OVERVIEW
Replace deprecated TypeScript path resolution with:
- Node.js internal aliases via package.json "imports" field (NOT "exports")
- TypeScript "NodeNext" module system
- Hash-prefixed imports: `#shared/*` (padrão oficial Node.js)

CRITICAL: Use `"imports"` for internal resolution, NOT `"exports"`.

This avoids:
- Deprecated baseUrl/paths (causes TS5101, TS5107 errors in TS 5.9+)
- Fragile relative paths (../../../../)
- Package name dependency for resolution

# 4. IMPLEMENTATION STEPS

**STEP 1: Update root package.json**
- Goal: Add ESM support and imports field (NOT exports)
- Method: Add `"type": "module"` and `"imports"` for internal resolution:
  ```json
  {
    "type": "module",
    "imports": {
      "#shared/*": "./shared/*"
    }
  }
  ```
- Reference: /workspace/project/iGaming_booster/package.json

**STEP 2: Replace tsconfig.base.json**
- Goal: Use modern NodeNext module resolution
- Method: Replace entire file content with NodeNext configuration
- Reference: /workspace/project/iGaming_booster/tsconfig.base.json

**STEP 3: Update apps/api/tsconfig.json**
- Goal: Remove baseUrl inheritance
- Method: Add explicit `moduleResolution: "NodeNext"` and remove baseUrl
- Reference: /workspace/project/iGaming_booster/apps/api/tsconfig.json

**STEP 4: Update apps/worker/tsconfig.json**
- Goal: Remove baseUrl inheritance, ensure NodeNext
- Method: Add explicit `moduleResolution: "NodeNext"` and remove baseUrl
- Reference: /workspace/project/iGaming_booster/apps/worker/tsconfig.json

**STEP 4b: Configure esbuild for #shared resolution**
- Goal: Make esbuild resolve #shared/* imports in worker bundle
- Method: Add alias configuration to apps/worker/scripts/build.js:
  ```js
  esbuild.build({
    // ... other options
    alias: {
      '#shared': path.resolve(__dirname, '../../shared')
    }
  })
  ```
- Reference: /workspace/project/iGaming_booster/apps/worker/scripts/build.js

**STEP 5: Update all @shared/ imports to #shared/*.js**
- Goal: Migrate from aliases to hash-prefixed imports with .js extension
- Method: Replace all `from '@shared/...'` with `from '#shared/...'` + `.js`
- CORRECT IMPORT FORMAT: `import db from "#shared/database/connection.js"`
- Files (22 total):
  1. apps/api/src/domains/fraud/repositories/rate-limit.repository.ts
  2. apps/api/src/domains/fraud/repositories/risk-signal.repository.ts
  3. apps/api/src/domains/fraud/repositories/fraud-score.repository.ts
  4. apps/api/src/domains/fraud/services/behavior.service.ts
  5. apps/api/src/domains/fraud/consumers/fraud-check-requested.consumer.ts
  6. apps/api/src/domains/raffles/application/draw-engine.ts
  7. apps/api/src/domains/raffles/application/close-raffle.ts
  8. apps/api/src/domains/raffles/application/get-active-raffle.ts
  9. apps/api/src/domains/raffles/consumers/raffle-draw-executed.consumer.ts
  10. apps/api/src/domains/raffles/consumers/reward-granted.consumer.ts
  11. apps/api/src/domains/rewards/use-cases/process-reward.use-case.ts
  12. apps/api/src/domains/rewards/repositories/reward-economics.repository.ts
  13. apps/api/src/domains/rewards/repositories/reward.repository.ts
  14. apps/api/src/domains/rewards/repositories/benefit-rule.repository.ts
  15. apps/api/src/domains/rewards/repositories/ticket.repository.ts
  16. apps/api/src/domains/rewards/services/experiment.service.ts
  17. apps/api/src/domains/validation/repositories/proof-validation.repository.ts
  18. apps/api/src/domains/validation/repositories/proof.repository.ts
  19. apps/api/src/domains/validation/consumers/validation-aggregator.consumer.ts
  20. apps/api/src/domains/payments/repositories/payment-signal.repository.ts
  21. apps/api/src/domains/payments/consumers/payment-identifier-requested.consumer.ts
  22. apps/worker/src/jobs/close-raffle.job.ts

**STEP 6: Build validation**
- Goal: Verify TypeScript compiles without deprecated errors
- Method: Run `npm ci && cd apps/api && npm run build`

**STEP 7: Runtime validation**
- Goal: Verify the application runs with Node.js ESM
- Method: Run both API and worker build, then run from project ROOT:
  - API: `cd apps/api && npm run build && node dist/apps/api/src/server/index.js`
  - Worker: `cd apps/worker && npm run build && node dist/worker.js`
- CRITICAL: Always run Node from project root directory for #shared imports to resolve

# 5. TESTING AND VALIDATION
Success criteria:
- No TS5101 (deprecated baseUrl) error
- No TS5107 (deprecated paths) error  
- No baseUrl or paths anywhere in tsconfig files
- Build passes without errors (both api and worker)
- API runtime starts without module resolution errors
- Worker runtime starts without module resolution errors
- All tsconfig files use NodeNext (no legacy bundler/node10 resolution)
