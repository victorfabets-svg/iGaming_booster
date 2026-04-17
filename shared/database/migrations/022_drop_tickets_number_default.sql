-- Fix raffles.tickets number column: remove DEFAULT, enforce explicit value
--.number must be provided explicitly on insert - no implicit defaults

-- Drop the default so inserts MUST provide number
ALTER TABLE raffles.tickets 
ALTER COLUMN number DROP DEFAULT;

-- Ensure NOT NULL (already in place from previous migration)
-- Now insert without number will FAIL - as required