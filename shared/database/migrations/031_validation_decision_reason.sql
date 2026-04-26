-- Sprint 7 — Rule engine: persist which rule version decided and why.
-- Both fields are nullable so historical rows keep their existing shape.

ALTER TABLE validation.proof_validations
  ADD COLUMN IF NOT EXISTS rule_version TEXT,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;