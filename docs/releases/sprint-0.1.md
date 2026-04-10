# Sprint 0.1 - Backend Foundation

## Release Summary

This release establishes the core backend foundation for the iGaming platform, delivering:
- REST API server with Express
- PostgreSQL database connection with connection pooling
- Event system with persistence-first guarantees
- Proof ingestion flow with idempotency enforcement

## Baseline Confirmation

**Commit Hash:** `4b9a99a`
**Tag:** `v0.1-backend-foundation`
**Date:** April 10, 2026
**Branch:** main

This represents the audited baseline state after Sprint 0.1 delivery.

## Delivered Components

### Core Infrastructure
- Database connection with singleton Pool (`shared/database/connection.ts`)
- Event model and append-only repository (`shared/events/`)
- Event emitter with persistence-first guarantees

### API Layer
- Express server setup (`apps/api/src/server.ts`, `apps/api/src/server/`)
- Proof submission endpoint (`apps/api/src/server/routes/proofs.ts`)

### Domain: Validation
- Proof domain model
- Proof repository with idempotency guarantees
- Use cases: `createProofUseCase`, `submitProof`, `processProofSubmitted`, `processValidation`

## Audit Status

✅ **AUDIT APPROVED** - This baseline is confirmed as the Sprint 0.1 deliverable.

## Notes

- All changes must follow: feature branch → audit → merge workflow
- No direct commits to main allowed
- All future releases must be tagged