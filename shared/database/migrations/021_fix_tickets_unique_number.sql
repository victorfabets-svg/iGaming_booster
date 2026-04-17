-- Fix raffles.tickets unique constraint: UNIQUE(raffle_id, number)
-- Currently only has UNIQUE(reward_id) which is insufficient

-- Add number column to tickets
ALTER TABLE raffles.tickets 
ADD COLUMN IF NOT EXISTS number INTEGER NOT NULL DEFAULT 0;

-- Drop the old insufficient constraint
ALTER TABLE raffles.tickets 
DROP CONSTRAINT IF EXISTS tickets_reward_id_key;

-- Add correct unique constraint: one ticket per raffle per number
ALTER TABLE raffles.tickets 
ADD CONSTRAINT tickets_raffle_number_key UNIQUE (raffle_id, number);

-- Update indexes for the new schema
DROP INDEX IF EXISTS idx_raffles_tickets_raffle_id;
CREATE INDEX idx_raffles_tickets_raffle_id ON raffles.tickets(raffle_id);

DROP INDEX IF EXISTS idx_raffles_tickets_user_id;
CREATE INDEX idx_raffles_tickets_user_id ON raffles.tickets(user_id);