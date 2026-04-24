-- 003_raffle_engine.sql
-- Raffle engine tables.
-- raffles.tickets is created here (idempotent) so that
-- raffles.raffle_draws.winner_ticket_id can FK it on fresh DBs.
-- The canonical 012_raffles_tickets.sql remains as a no-op safety net.


BEGIN;


-- raffles.tickets — created idempotently. All FK targets already exist
-- from 001_init.sql (identity.users, validation.proofs,
-- rewards.rewards, raffles.raffles).
CREATE TABLE IF NOT EXISTS raffles.tickets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES identity.users(id),
  proof_id   UUID NOT NULL REFERENCES validation.proofs(id),
  reward_id  UUID NOT NULL REFERENCES rewards.rewards(id),
  raffle_id  UUID NOT NULL REFERENCES raffles.raffles(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (reward_id)
);


CREATE INDEX IF NOT EXISTS idx_raffles_tickets_raffle_id
  ON raffles.tickets(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffles_tickets_user_id
  ON raffles.tickets(user_id);


-- RAFFLE DRAWS (Deterministic Draw System)
CREATE TABLE IF NOT EXISTS raffles.raffle_draws (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
raffle_id UUID NOT NULL REFERENCES raffles.raffles(id),
seed TEXT NOT NULL,
algorithm_version TEXT NOT NULL DEFAULT 'v1',
winner_user_id UUID REFERENCES identity.users(id),
winner_ticket_id UUID REFERENCES raffles.tickets(id),
UNIQUE (raffle_id)
);


COMMIT;