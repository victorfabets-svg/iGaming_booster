-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SCHEMAS (must exist before tables)
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS validation;
CREATE SCHEMA IF NOT EXISTS fraud;
CREATE SCHEMA IF NOT EXISTS rewards;
CREATE SCHEMA IF NOT EXISTS raffles;
CREATE SCHEMA IF NOT EXISTS events;


-- USERS
CREATE TABLE identity.users (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
email TEXT UNIQUE,
phone TEXT UNIQUE,
status TEXT NOT NULL DEFAULT 'active',
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- PROOFS
CREATE TABLE validation.proofs (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES identity.users(id),
file_url TEXT NOT NULL,
hash TEXT NOT NULL UNIQUE,
submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add unique constraint on hash for idempotency
ALTER TABLE validation.proofs ADD CONSTRAINT proofs_hash_key UNIQUE (hash);


-- PROOF VALIDATIONS
CREATE TABLE validation.proof_validations (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
proof_id UUID NOT NULL REFERENCES validation.proofs(id),
status TEXT NOT NULL,
confidence_score NUMERIC(3,2),
validation_version TEXT NOT NULL,
validated_at TIMESTAMP,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- FRAUD SCORES
CREATE TABLE fraud.fraud_scores (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
proof_id UUID NOT NULL REFERENCES validation.proofs(id),
score NUMERIC(3,2) NOT NULL,
signals JSONB NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- REWARDS
CREATE TABLE rewards.rewards (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES identity.users(id),
proof_id UUID NOT NULL REFERENCES validation.proofs(id),
type TEXT NOT NULL,
status TEXT NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
UNIQUE (proof_id)
);


-- RAFFLES
CREATE TABLE raffles.raffles (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
name TEXT NOT NULL,
prize TEXT NOT NULL,
total_numbers INT NOT NULL,
draw_date TIMESTAMP NOT NULL,
status TEXT NOT NULL
);


-- TICKETS
CREATE TABLE rewards.tickets (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES identity.users(id),
raffle_id UUID NOT NULL REFERENCES raffles.raffles(id),
number INT NOT NULL,
reward_id UUID NOT NULL REFERENCES rewards.rewards(id),
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
UNIQUE (raffle_id, number)
);


-- EVENTS (CORE)
CREATE TABLE events.events (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
event_type TEXT NOT NULL,
version TEXT NOT NULL,
timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
producer TEXT NOT NULL,
correlation_id TEXT NOT NULL,
payload JSONB NOT NULL
);