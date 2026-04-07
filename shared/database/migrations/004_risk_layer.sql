-- RISK SIGNALS
CREATE TABLE IF NOT EXISTS fraud.risk_signals (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES identity.users(id),
signal_type TEXT NOT NULL,
value TEXT NOT NULL,
metadata JSONB,
created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS fraud.rate_limits (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES identity.users(id),
limit_type TEXT NOT NULL,
count INT NOT NULL DEFAULT 0,
window_start TIMESTAMP NOT NULL DEFAULT NOW(),
window_end TIMESTAMP NOT NULL,
UNIQUE (user_id, limit_type)
);

CREATE INDEX idx_risk_signals_user_id ON fraud.risk_signals(user_id);
CREATE INDEX idx_risk_signals_signal_type ON fraud.risk_signals(signal_type);
CREATE INDEX idx_rate_limits_user_id ON fraud.rate_limits(user_id);