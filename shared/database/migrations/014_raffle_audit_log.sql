-- 014_raffle_audit_log.sql
-- Immutable audit ledger for raffle draws - enables cryptographic proof and reconstruction

BEGIN;

-- Create audit log table (immutable, append-only)
CREATE TABLE IF NOT EXISTS raffles.raffle_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL,
  seed TEXT NOT NULL,
  total_tickets INTEGER NOT NULL,
  winner_ticket_id UUID,
  winner_user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying by raffle (common lookup pattern)
CREATE INDEX IF NOT EXISTS idx_raffle_audit_log_raffle_id
  ON raffles.raffle_audit_log(raffle_id);

-- Index for time-based queries (audit trail)
CREATE INDEX IF NOT EXISTS idx_raffle_audit_log_created_at
  ON raffles.raffle_audit_log(created_at DESC);

COMMIT;