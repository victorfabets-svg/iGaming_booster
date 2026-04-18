-- Add next_number column to raffles for deterministic ticket number sequence

ALTER TABLE raffles.raffles 
ADD COLUMN IF NOT EXISTS next_number INTEGER NOT NULL DEFAULT 1;