-- Add UNIQUE constraint on reward_id for idempotency
ALTER TABLE rewards.tickets 
ADD CONSTRAINT tickets_reward_id_key UNIQUE (reward_id);