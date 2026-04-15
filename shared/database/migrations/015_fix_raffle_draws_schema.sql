-- Migration: 015_fix_raffle_draws_schema.sql
-- Safe patch for existing DBs that may have old schema
-- Ensures consistency across ALL environments (fresh and existing)

-- Drop legacy columns if they exist (safe - IF EXISTS)
ALTER TABLE raffles.raffle_draws
DROP COLUMN IF EXISTS algorithm,
DROP COLUMN IF EXISTS result_number,
DROP COLUMN IF EXISTS executed_at;

-- Ensure algorithm_version column exists with correct default (safe - IF NOT EXISTS)
ALTER TABLE raffles.raffle_draws
ADD COLUMN IF NOT EXISTS algorithm_version TEXT NOT NULL DEFAULT 'v1';

-- Final schema guaranteed to be:
-- raffle_id (UNIQUE)
-- seed
-- algorithm_version
-- winner_user_id
-- winner_ticket_id