-- Sprint 7 Task 7 — Economics fields per validation decision.
-- All nullable so historical rows keep their shape.
ALTER TABLE validation.proof_validations
  ADD COLUMN IF NOT EXISTS cost_centavos       INT,
  ADD COLUMN IF NOT EXISTS value_centavos      INT,
  ADD COLUMN IF NOT EXISTS economics_version   TEXT;