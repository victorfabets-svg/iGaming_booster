-- 013_processed_events.sql
-- Exactly-once event processing: prevent duplicate processing

BEGIN;

-- Processed events table for idempotency check
CREATE TABLE IF NOT EXISTS events.processed_events (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at
  ON events.processed_events(processed_at DESC);

COMMIT;