-- Extend benefit_rules with dynamic fields
ALTER TABLE rewards.benefit_rules 
ADD COLUMN IF NOT EXISTS risk_multiplier NUMERIC(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS max_per_user INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dynamic_flag BOOLEAN DEFAULT FALSE;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_benefit_rules_dynamic ON rewards.benefit_rules(dynamic_flag);