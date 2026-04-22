-- 013_processed_events.sql
-- Exactly-once event processing: create table + enforce composite PK.
-- Idempotent for both fresh and legacy databases.


BEGIN;


-- Create the table if it does not exist yet (fresh DB).
CREATE TABLE IF NOT EXISTS events.processed_events (
  event_id     TEXT NOT NULL,
  consumer_name TEXT NOT NULL DEFAULT 'default_consumer',
  processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, consumer_name)
);


-- For legacy DBs where the table exists without consumer_name, add it.
ALTER TABLE events.processed_events
  ADD COLUMN IF NOT EXISTS consumer_name TEXT NOT NULL DEFAULT 'default_consumer';

-- Drop any old single-column PK (legacy shape) if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'events'
      AND t.relname = 'processed_events'
      AND c.contype = 'p'
      AND array_length(c.conkey, 1) = 1
  ) THEN
    EXECUTE 'ALTER TABLE events.processed_events DROP CONSTRAINT ' ||
            (SELECT conname
             FROM pg_constraint c
             JOIN pg_class t ON t.oid = c.conrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE n.nspname = 'events'
               AND t.relname = 'processed_events'
               AND c.contype = 'p'
             LIMIT 1);
  END IF;
END$$;


-- Ensure the composite PK exists (only if not already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'events'
      AND t.relname = 'processed_events'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE events.processed_events
      ADD PRIMARY KEY (event_id, consumer_name);
  END IF;
END$$;


COMMIT;
