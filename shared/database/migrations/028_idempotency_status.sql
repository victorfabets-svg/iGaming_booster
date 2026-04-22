-- Add status column for atomic idempotency
ALTER TABLE infra.idempotency_keys
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Update default for existing rows
UPDATE infra.idempotency_keys
SET status = 'done'
WHERE status IS NULL;

-- Ensure not null
ALTER TABLE infra.idempotency_keys
ALTER COLUMN status SET NOT NULL;