-- Create raffles.tickets table for event-driven ticket creation
-- This table is used by reward_granted consumer for idempotent ticket creation

CREATE TABLE raffles.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(id),
  proof_id UUID NOT NULL REFERENCES validation.proofs(id),
  reward_id UUID NOT NULL REFERENCES rewards.rewards(id),
  raffle_id UUID NOT NULL REFERENCES raffles.raffles(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (reward_id)
);

CREATE INDEX idx_raffles_tickets_raffle_id ON raffles.tickets(raffle_id);
CREATE INDEX idx_raffles_tickets_user_id ON raffles.tickets(user_id);