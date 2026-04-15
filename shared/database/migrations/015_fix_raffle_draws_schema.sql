-- Migration: 015_fix_raffle_draws_schema.sql
-- Fix schema mismatch between raffle_draws table and deterministic draw system
-- Target: raffles.raffle_draws

-- Drop columns that are no longer needed (deterministic system doesn't use these)
ALTER TABLE raffles.raffle_draws
DROP COLUMN IF EXISTS algorithm,
DROP COLUMN IF EXISTS result_number,
DROP COLUMN IF EXISTS executed_at;

-- Add algorithm_version column for deterministic draw versioning
ALTER TABLE raffles.raffle_draws
ADD COLUMN IF NOT EXISTS algorithm_version TEXT NOT NULL DEFAULT 'v1';

-- Verify final structure (should match deterministic architecture)
-- raffle_id (UNIQUE)
-- seed
-- algorithm_version
-- winner_user_id (optional)
-- winner_ticket_id (optional)