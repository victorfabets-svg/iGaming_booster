-- Feature flags table for runtime configuration without restart
-- Sprint 8 T9: DB-backed feature flags with periodic sync

-- Cria a tabela autoritativa de feature flags em infra schema.
CREATE TABLE IF NOT EXISTS infra.feature_flags (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

-- Seed inicial preservando defaults do código.
-- ON CONFLICT ensures idempotency if table already exists with data.
INSERT INTO infra.feature_flags (name, enabled, updated_by) VALUES
  ('FRAUD_V1_ENABLED', true, 'sprint-8-t9-bootstrap'),
  ('STRICT_MODE', false, 'sprint-8-t9-bootstrap')
ON CONFLICT (name) DO NOTHING;