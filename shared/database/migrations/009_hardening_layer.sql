-- 009_hardening_layer.sql
-- Move all runtime DDL to versioned migration

BEGIN;

-- 1. SCHEMA
CREATE SCHEMA IF NOT EXISTS audit;

-- 2. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
  ON audit.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
  ON audit.audit_logs(created_at DESC);

-- 3. EVENTS HARDENING
ALTER TABLE events.events 
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

ALTER TABLE events.events 
  ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

ALTER TABLE events.events 
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;

-- 4. DLQ
CREATE TABLE IF NOT EXISTS events.dlq_events (
  event_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  error TEXT,
  retries INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_created 
  ON events.dlq_events(created_at DESC);

COMMIT;