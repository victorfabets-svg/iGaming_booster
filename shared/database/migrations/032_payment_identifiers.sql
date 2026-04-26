-- Sprint 7 — Persist extracted payment identifiers for cross-proof dedup.
CREATE TABLE IF NOT EXISTS payments.payment_identifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proof_id UUID NOT NULL REFERENCES validation.proofs(id),
  type TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  confidence NUMERIC(3,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_identifiers_proof
  ON payments.payment_identifiers(proof_id);
CREATE INDEX IF NOT EXISTS idx_payment_identifiers_normalized
  ON payments.payment_identifiers(normalized_value);