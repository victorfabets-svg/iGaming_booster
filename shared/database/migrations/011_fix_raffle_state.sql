-- Migration to fix raffle state values (executed -> completed)
-- and ensure proper state machine

-- Fix any raffles set to 'executed' status
UPDATE raffles.raffles SET status = 'completed' WHERE status = 'executed';

-- Ensure proper enum values if needed (PostgreSQL enum would be created separately)
-- This migration ensures data consistency