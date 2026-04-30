-- Migration 048: add promotion_id to validation.proofs
-- Allows a proof to be attributed to the promotion the user submitted from.
-- Nullable: legacy proofs without promotion context remain valid.

ALTER TABLE validation.proofs
  ADD COLUMN IF NOT EXISTS promotion_id UUID
  REFERENCES promotions.promotions(id);

CREATE INDEX IF NOT EXISTS proofs_promotion_idx
  ON validation.proofs(promotion_id) WHERE promotion_id IS NOT NULL;
