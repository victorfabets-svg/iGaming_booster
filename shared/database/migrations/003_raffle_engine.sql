-- RAFFLE DRAWS (Deterministic Draw System)
CREATE TABLE IF NOT EXISTS raffles.raffle_draws (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
raffle_id UUID NOT NULL REFERENCES raffles.raffles(id),
seed TEXT NOT NULL,
algorithm_version TEXT NOT NULL DEFAULT 'v1',
winner_user_id UUID REFERENCES identity.users(id),
winner_ticket_id UUID REFERENCES rewards.tickets(id),
UNIQUE (raffle_id)
);