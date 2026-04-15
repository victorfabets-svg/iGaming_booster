-- 013_processed_events.sql
-- Exactly-once event processing: prevent duplicate processing

BEGIN;

-- Add consumer_name column first (if not exists)
ALTER TABLE events.processed_events 
ADD COLUMN IF NOT EXISTS consumer_name TEXT NOT NULL DEFAULT 'default_consumer';

-- Drop old primary key
ALTER TABLE events.processed_events DROP CONSTRAINT IF EXISTS processed_events_pkey;

-- Add new composite primary key for (event_id, consumer_name)
ALTER TABLE events.processed_events 
ADD PRIMARY KEY (event_id, consumer_name);

COMMIT;