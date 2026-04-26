-- Sprint 9 T1: real auth with password hashing + refresh token rotation.
-- password_hash nullable na primeira passagem (legacy users sem senha
-- continuam existindo ate set-password flow do Sprint 10).
ALTER TABLE identity.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP;

-- Refresh tokens com rotation + reuse detection.
-- family_id agrupa toda a cadeia de rotacao de um unico login;
-- detectar replay de revoked = revogar a familia inteira.
CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES identity.users(id),
  family_id       UUID NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  issued_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMP NOT NULL,
  revoked_at      TIMESTAMP,
  revoked_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON identity.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
  ON identity.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
  ON identity.refresh_tokens(expires_at)
  WHERE revoked_at IS NULL;