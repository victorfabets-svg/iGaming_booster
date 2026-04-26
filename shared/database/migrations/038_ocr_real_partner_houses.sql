-- Migration 038: OCR real (Anthropic Vision) + partner houses data plane
-- Sprint 9 T3

-- partner_houses: dados de casas pra matching pós-OCR
CREATE TABLE IF NOT EXISTS validation.partner_houses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  ocr_aliases TEXT[] NOT NULL DEFAULT '{}',
  deposit_keywords TEXT[] NOT NULL DEFAULT '{}',
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),
  regex_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_houses_country_active
  ON validation.partner_houses(country, active);

-- ocr_calls: audit + cost tracking (1 row por chamada Anthropic)
CREATE TABLE IF NOT EXISTS validation.ocr_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proof_id UUID,
  file_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10,6),
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error','timeout')),
  error_code TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocr_calls_file_hash ON validation.ocr_calls(file_hash);
CREATE INDEX IF NOT EXISTS idx_ocr_calls_created_at ON validation.ocr_calls(created_at);

-- Flag T3_OCR_REAL_ENABLED (default false)
INSERT INTO infra.feature_flags (name, enabled, updated_at, updated_by)
VALUES ('T3_OCR_REAL_ENABLED', false, NOW(), 'migration-038')
ON CONFLICT (name) DO NOTHING;