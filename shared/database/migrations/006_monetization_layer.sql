-- REWARD ECONOMICS
CREATE TABLE IF NOT EXISTS rewards.reward_economics (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
reward_id UUID NOT NULL REFERENCES rewards.rewards(id),
cost NUMERIC(10,2) NOT NULL,
estimated_revenue NUMERIC(10,2) NOT NULL,
margin NUMERIC(10,2) NOT NULL,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reward_economics_reward_id ON rewards.reward_economics(reward_id);

-- EXPERIMENT ASSIGNMENTS
CREATE TABLE IF NOT EXISTS rewards.experiment_assignments (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES identity.users(id),
experiment_name TEXT NOT NULL,
variant TEXT NOT NULL,
assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
UNIQUE (user_id, experiment_name)
);

CREATE INDEX idx_experiment_assignments_user_id ON rewards.experiment_assignments(user_id);
CREATE INDEX idx_experiment_assignments_experiment ON rewards.experiment_assignments(experiment_name);