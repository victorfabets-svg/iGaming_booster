-- OCR Cache by file_hash
-- Deduplicates OCR calls: same file_hash = cache hit, zero Anthropic cost

CREATE TABLE IF NOT EXISTS validation.ocr_cache (
  file_hash TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  cost_saved_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_hit_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ocr_cache_expires_at ON validation.ocr_cache(expires_at);

-- Flag T4_OCR_CACHE_ENABLED (default false)
INSERT INTO infra.feature_flags (name, enabled, updated_at, updated_by)
VALUES ('T4_OCR_CACHE_ENABLED', false, NOW(), 'migration-039')
ON CONFLICT (name) DO NOTHING;
