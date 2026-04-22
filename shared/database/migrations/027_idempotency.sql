-- Idempotency keys table for API-level duplicate prevention
CREATE TABLE IF NOT EXISTS infra.idempotency_keys (
  key TEXT PRIMARY KEY,
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created 
ON infra.idempotency_keys(created_at);