-- Add status column to rewards table (needed by reward_granted consumer)
-- The rewards table was created without status column in migration 008
ALTER TABLE rewards.rewards ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'granted';

-- Create migration to add status column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' 
    AND column_name = 'status'
    AND table_schema = 'rewards'
  ) THEN
    ALTER TABLE rewards.rewards ADD COLUMN status TEXT NOT NULL DEFAULT 'granted';
  END IF;
END $$;