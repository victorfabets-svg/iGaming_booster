-- Migration: Add UNIQUE constraint on reward_id for idempotency
-- Critical: ensures same reward_id never creates more than one ticket
-- This is the idempotency key for the reward → ticket pipeline

-- Add unique constraint on reward_id (allows one ticket per reward)
ALTER TABLE raffles.tickets 
ADD CONSTRAINT tickets_reward_id_unique UNIQUE (reward_id);

-- Verify constraint was added
-- This ensures: same reward_id MUST NEVER create more than one ticket