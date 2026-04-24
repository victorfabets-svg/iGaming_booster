-- 012_raffles_tickets.sql
-- NO-OP on fresh DBs: raffles.tickets is now created in 003.
-- Kept as idempotent safety net for legacy DBs that skipped 003.


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