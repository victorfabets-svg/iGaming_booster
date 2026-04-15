-- Migration: 016_fix_rewards_schema.sql
-- Fix rewards.rewards schema inconsistency:
-- - status column has NOT NULL without DEFAULT (breaks INSERT)
-- - Remove type column (deprecated, redundant with reward_type from v2)
--
-- Persistence before effect: Set default BEFORE updating to maintain consistency

BEGIN;

-- Step 1: Set DEFAULT for status column (required BEFORE update for new inserts)
ALTER TABLE rewards.rewards ALTER COLUMN status SET DEFAULT 'granted';

-- Step 2: Update NULL status values to 'granted' (persist before effect)
UPDATE rewards.rewards SET status = 'granted' WHERE status IS NULL;

-- Step 3: Now enforce NOT NULL (safe after all NULLs resolved)
ALTER TABLE rewards.rewards ALTER COLUMN status SET NOT NULL;

-- Step 4: Drop deprecated type column (replaced by reward_type in v2)
ALTER TABLE rewards.rewards DROP COLUMN IF EXISTS type;

COMMIT;