-- 015_processed_events.sql
-- Exactly-once event processing: prevent duplicate processing
-- Creates the processed_events table for idempotency tracking

CREATE TABLE IF NOT EXISTS events.processed_events (
  event_id TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, consumer_name)
);