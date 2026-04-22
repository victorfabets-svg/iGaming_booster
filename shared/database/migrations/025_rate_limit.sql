-- Rate limiting table for persisted rate limiting
CREATE TABLE IF NOT EXISTS infra.rate_limits (
  key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient key and time-based queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time 
ON infra.rate_limits(key, created_at);