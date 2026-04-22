-- 029_events_add_created_at.sql
-- Add created_at column to events.events. The code (transactional outbox,
-- event repository, raffle-draw use-case) expects this column; schema had
-- only `timestamp`. Additive and idempotent for fresh + legacy DBs.


BEGIN;


ALTER TABLE events.events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();


-- Backfill null created_at from the existing `timestamp` column so any
-- legacy rows are valid before we set NOT NULL.
UPDATE events.events
  SET created_at = timestamp
  WHERE created_at IS NULL;


-- Tighten to NOT NULL once backfill has run.
ALTER TABLE events.events
  ALTER COLUMN created_at SET NOT NULL;


-- Index to support ORDER BY created_at DESC used by event.repository.ts.
CREATE INDEX IF NOT EXISTS idx_events_events_created_at
  ON events.events (created_at DESC);


COMMIT;