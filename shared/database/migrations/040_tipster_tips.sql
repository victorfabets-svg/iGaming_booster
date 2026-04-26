CREATE SCHEMA IF NOT EXISTS tipster;

CREATE TABLE IF NOT EXISTS tipster.tips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT UNIQUE NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  event_name TEXT NOT NULL,
  event_starts_at TIMESTAMP NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds NUMERIC(10,3) NOT NULL CHECK (odds > 1),
  stake_units NUMERIC(8,2) NOT NULL CHECK (stake_units > 0),
  confidence INTEGER,
  house_slug TEXT,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending','won','lost','void')),
  settled_at TIMESTAMP,
  settled_value NUMERIC(10,2),
  tipster_created_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_status ON tipster.tips(status);
CREATE INDEX IF NOT EXISTS idx_tips_event_starts_at ON tipster.tips(event_starts_at);
CREATE INDEX IF NOT EXISTS idx_tips_house_slug ON tipster.tips(house_slug);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tipster.tips(created_at);