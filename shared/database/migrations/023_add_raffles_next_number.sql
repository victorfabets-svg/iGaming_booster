-- Migration: Add next_number column to raffles for deterministic ticket generation
-- This enables sequential, unique ticket numbers without Math.random()

ALTER TABLE raffles.raffles 
ADD COLUMN IF NOT EXISTS next_number INT NOT NULL DEFAULT 1;

-- Initialize next_number for existing raffles based on current max ticket number
UPDATE raffles.raffles r
SET next_number = COALESCE(
  (SELECT MAX(t.number) + 1 FROM raffles.tickets t WHERE t.raffle_id = r.id),
  1
);

-- Ensure next_number is always >= 1
UPDATE raffles.raffles 
SET next_number = 1 
WHERE next_number < 1 OR next_number IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_raffles_next_number ON raffles.raffles(id) WHERE next_number IS NOT NULL;