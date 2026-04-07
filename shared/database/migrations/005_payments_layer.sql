-- PAYMENT SIGNALS
CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE IF NOT EXISTS payments.payment_signals (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
proof_id UUID NOT NULL REFERENCES validation.proofs(id),
type TEXT NOT NULL,
value TEXT NOT NULL,
confidence NUMERIC(3,2),
metadata JSONB,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_signals_proof_id ON payments.payment_signals(proof_id);
CREATE INDEX idx_payment_signals_type ON payments.payment_signals(type);