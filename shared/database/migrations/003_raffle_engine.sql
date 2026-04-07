-- RAFFLE DRAWS
CREATE TABLE IF NOT EXISTS raffles.raffle_draws (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
raffle_id UUID NOT NULL REFERENCES raffles.raffles(id),
seed TEXT NOT NULL,
algorithm TEXT NOT NULL,
result_number INT NOT NULL,
winner_user_id UUID REFERENCES identity.users(id),
winner_ticket_id UUID REFERENCES rewards.tickets(id),
executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
UNIQUE (raffle_id)
);