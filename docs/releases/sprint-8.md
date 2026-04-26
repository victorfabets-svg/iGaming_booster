# Sprint 8 — Scale + Optimization

## Release Summary

Sprint 8 focused on capability/infra readiness and pre-tuning levers for the
optimization phase. The runtime pipeline is now self-healing on schema/extension
drift, latency-bounded under target, and safely tunable without redeploy.

Phase A (capability/infra) shipped end-to-end. Phase B (data-driven tuning)
deferred until production traffic accumulates — the spec's optimization tasks
(T1, T2, T5) cannot be executed meaningfully against synthetic fixtures without
becoming guesswork.

## Baseline Confirmation

**Branch:** main
**Date:** 2026-04-26
**Audit:** `runtime-check.yml` passing 8/8 event chain on every merge in this sprint
**Migration tracking:** 35/35 (DB sync via reconcile mode of PR #51/#52)

## Delivered Components

### Migration runner self-healing

| PR | Concern | Surface |
|----|---------|---------|
| #47 | Secret split owner/app_user wiring | `.github/workflows/migrate.yml`, scripts |
| #48 | Preflight role check (CREATE on database) | `.github/workflows/migrate.yml` |
| #50 | Point migrate workflow at `NEON_DB_URL_DIRECT` | workflow + scripts |
| #51, #52 | Reconcile mode → auto-recover from tracking drift | `apps/api/src/scripts/run-migrations.ts` |
| #54 | Remove duplicate preflight (zombie branch incident) | `.github/workflows/migrate.yml` |
| #55 | Generate tracking UUID from app, not DB DEFAULT | `apps/api/src/scripts/run-migrations.ts` |
| #56 | Auto-install `uuid-ossp` extension before migrations | `apps/api/src/scripts/run-migrations.ts` |
| #57 | Auto-create expected schemas before migrations | `apps/api/src/scripts/run-migrations.ts` |

The runner now survives any Neon branch restore/clone with no manual setup —
schema drift, extension absence, and tracking drift all auto-recover.

### CI hygiene

| PR | Surface |
|----|---------|
| #49 | Deploy guard skips cleanly when canary not configured |

### Sprint 8 spec tasks completed

| Task | PR | Description |
|------|----|----|
| **T6** Latency control | #58 | Consumer poll interval 5s/2s → 1s default, env-tunable. Synthetic E2E cut from ~14s to ~8s. Production worst-case projected 7-10s (was ~48s) |
| **T9** Safe rollout / flags without restart | #59 | DB-backed `infra.feature_flags` with periodic sync (30s) into `process.env`. Operator flips via SQL, no redeploy. Zero-refactor of existing `getFlag` callers |
| **T3** Cost control / short-circuit | #60 | Two-stage pipeline: when `fraud_score ≥ 0.85`, aggregator emits rejection immediately and skips payment extraction. Gated behind `T3_SHORT_CIRCUIT_ENABLED` flag, default OFF |

### Governance

| PR | Description |
|----|-------------|
| #61 | Branch cleanup script (`scripts/cleanup-merged-branches.sh`) + executed deletion of 33 zombie branches. Repo went from 41+ to 9 remote branches |

## Phase B — Pending Production Traffic

These tasks are blocked on real dataset, not on engineering capacity:

| Task | Why blocked |
|------|-------------|
| **T1** Threshold tuning | Spec calls for sweep against 24-72h dataset; without traffic, any choice is guesswork |
| **T2** Manual review reduction | Tie-breaker rules (user history, identifier repetition, temporal consistency) need observed manual_review distribution |
| **T5** Fraud signals v2 | Velocity/frequency/temporal signals need real per-user/IP patterns to separate FP from FN |
| **T7** Metrics dashboard tuning | Sprint 7 base (`/metrics/funnel`) is in production. Tuning lift requires baseline observation |
| **T8** Alert tuning | Sprint 7 base (`/alerts`) is in production. Threshold calibration requires baseline observation |

Activating T3 in staging (operational step, see below) starts populating the
first signal — `cost_per_proof` on rejected proofs.

## Gap

**T4 — Dedup/replay optimization (cache by file_hash + payment_identifier with TTL)**
was in the original Sprint 8 spec but not addressed in this sprint. It does
NOT depend on traffic data and could be picked up in Sprint 9 if cost
optimization remains a priority. Estimated effort: 1 PR, similar shape to T3
(flag-gated, reversible).

## Operational Handoff

Required actions on operator side:

1. **Activate T3 in staging** to start measuring cost savings:
   ```sql
   UPDATE infra.feature_flags
     SET enabled = true, updated_at = NOW(), updated_by = 't3-rollout'
     WHERE name = 'T3_SHORT_CIRCUIT_ENABLED';
   ```
   Propagation ≤30s via flag-sync. Reversible via the same UPDATE with
   `enabled = false`.

2. **Enable auto-delete head branches** in GitHub Settings → General →
   Pull Requests. Prevents the orphan-branch pattern that caused PR #53.

3. **Triage 7 preserved branches** (skipped by cleanup script):
   - `feature/backend-dev-setup` (2 commits ahead)
   - `feature/backend-sprint-5-5-observability` (no merged PR)
   - `feature/sprint-7-02-rule-engine-redo` (no merged PR)
   - `feature/sprint-7-05-observability` (no merged PR)
   - `fix/backend-dev-followups` (1 commit ahead)
   - `fix/sprint-6-spec-compliance` (1 commit ahead)
   - `temp-frontend-sprint-1` (1 commit ahead)

   Decision per branch: merge / abandon / keep WIP.

## Lessons Learned

**Zombie branches are a real risk.** PR #53 demonstrated that a stale branch
sitting unmerged + GitHub's 3-way merge can corrupt main by appending instead
of replacing — the duplicate preflight step that broke migrate workflow ran
production-blocking failures until #54 hotfixed it. Mitigation now in place
(auto-delete setting recommended; cleanup script reusable).

**Branch governance heuristic adopted mid-sprint:**

| Situation | Action |
|---|---|
| Open PR not merged yet | Push additional commit on existing branch |
| Recently merged branch + small related fix | Reopen/extend before merge or amend |
| Independent concern, separate review | New branch justified |
| Speculative improvement without clear value | Discard — don't create |
| Hotfix urgent in production | New branch justified |

This filter cut PR volume in second half of Sprint 8 and is the heuristic to
inherit into Sprint 9.

**Sprint 8 also surfaced the schema-drift class of bugs.** Three separate drift
cases (missing schemas, missing extensions, tracking row gaps) all manifested
as migration failures. Runner is now defensive against all three — but the
takeaway for Sprint 9 is to apply the same defense-in-depth thinking to other
runtime assumptions (e.g., assumed-but-unchecked DB column types, assumed-but-
unchecked event payload shapes).

## Sprint 9 Inputs

Recommended priorities to consider when scoping Sprint 9:

1. **T4 caching** if cost reduction remains a P0 — it's traffic-independent
2. **Activate T3 + observe** for 1-2 weeks before tuning T1 thresholds
3. **First data-driven task: T1** as soon as 24-72h of traffic is available
4. **T7/T8 calibration** once baselines emerge
5. **Schema/payload contract enforcement** as a defense-in-depth follow-up to
   the migrate runner work

## Audit Status

✅ **Phase A APPROVED** — capability/infra delivered; runtime-check passing;
governance hygiene restored.

🟡 **Phase B PENDING DATA** — T1/T2/T5/T7/T8 deferred to Sprint 9+ once
production traffic accumulates.

## PR Index

#47, #48, #49, #50, #51, #52, #54, #55, #56, #57, #58, #59, #60, #61

(PR #53 omitted: zombie-branch incident reverted by #54, retained in history
for postmortem reference.)
