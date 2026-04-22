-- Audit logs table for tracking critical actions
CREATE TABLE IF NOT EXISTS audit.logs (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
ON audit.logs(user_id);

-- Index for efficient action lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit.logs(action);