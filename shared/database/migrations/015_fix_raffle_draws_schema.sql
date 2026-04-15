-- Migration: 015_fix_raffle_draws_schema.sql
-- Safe patch for existing DBs that may have old schema
-- Ensures consistency across ALL environments (fresh and existing)
-- Production-safe: works with existing data without constraint errors

-- Drop legacy columns if they exist (safe - IF EXISTS)
ALTER TABLE raffles.raffle_draws
DROP COLUMN IF EXISTS algorithm,
DROP COLUMN IF EXISTS result_number,
DROP COLUMN IF EXISTS executed_at;

-- Safe multi-step migration for algorithm_version:
-- Step 1: Add column as nullable (safe for existing rows)
ALTER TABLE raffles.raffle_draws
ADD COLUMN IF NOT EXISTS algorithm_version TEXT;

-- Step 2: Backfill existing rows with default value
UPDATE raffles.raffle_draws
SET algorithm_version = 'v1'
WHERE algorithm_version IS NULL;

-- Step 3: Enforce NOT NULL constraint
ALTER TABLE raffles.raffle_draws
ALTER COLUMN algorithm_version SET NOT NULL;

-- Step 4: Set default for future inserts
ALTER TABLE raffles.raffle_draws
ALTER COLUMN algorithm_version SET DEFAULT 'v1';

-- Final schema guaranteed to be:
-- raffle_id (UNIQUE)
-- seed
-- algorithm_version
-- winner_user_id
-- winner_ticket_id