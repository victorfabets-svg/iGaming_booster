-- 021_fix_tickets_unique_number.sql
-- Fix raffles.tickets unique constraint: UNIQUE(raffle_id, number)
-- Currently only has UNIQUE(reward_id) which is insufficient.
-- Made fully idempotent so fresh + legacy DBs both converge.


BEGIN;


-- Add number column to tickets (idempotent)
ALTER TABLE raffles.tickets
  ADD COLUMN IF NOT EXISTS number INTEGER NOT NULL DEFAULT 0;


-- Drop the old insufficient constraint if it still exists
ALTER TABLE raffles.tickets
  DROP CONSTRAINT IF EXISTS tickets_reward_id_key;


-- Add correct unique constraint only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'raffles'
      AND t.relname = 'tickets'
      AND c.conname = 'tickets_raffle_number_key'
  ) THEN
    ALTER TABLE raffles.tickets
      ADD CONSTRAINT tickets_raffle_number_key UNIQUE (raffle_id, number);
  END IF;
END$$;


-- Ensure expected indexes exist. Definitions are byte-identical to
-- those in 003/012 so no drop+recreate is needed. IF NOT EXISTS makes
-- re-apply safe and avoids the schema-qualification pitfall with
-- unqualified DROP INDEX.
CREATE INDEX IF NOT EXISTS idx_raffles_tickets_raffle_id
  ON raffles.tickets(raffle_id);


CREATE INDEX IF NOT EXISTS idx_raffles_tickets_user_id
  ON raffles.tickets(user_id);


COMMIT;