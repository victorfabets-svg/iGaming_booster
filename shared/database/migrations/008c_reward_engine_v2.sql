-- UPDATE REWARDS TABLE TO MATCH SPEC
-- Add new columns for reward_type and value
ALTER TABLE rewards.rewards ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT 'approval';
ALTER TABLE rewards.rewards ADD COLUMN IF NOT EXISTS value NUMERIC(10,2) NOT NULL DEFAULT 10;

-- The existing table already has unique constraint on proof_id
-- Verify or add unique constraint on proof_id for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rewards_proof_id_key' 
    AND table_schema = 'rewards'
  ) THEN
    ALTER TABLE rewards.rewards ADD CONSTRAINT rewards_proof_id_key UNIQUE (proof_id);
  END IF;
END $$;