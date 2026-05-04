-- Migration 050: featured promotion on landing page.
-- Adds is_featured to promotions.promotions; the partial UNIQUE guarantees
-- at most one promotion is marked featured at any time. Toggling a new
-- featured promo from the API zeroes the previous one inside a transaction.
-- Idempotent: safe to re-run.

ALTER TABLE promotions.promotions
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS promotions_one_featured_idx
  ON promotions.promotions (is_featured) WHERE is_featured = TRUE;
