-- BENEFIT RULES
CREATE TABLE IF NOT EXISTS rewards.benefit_rules (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
min_amount NUMERIC(10,2) NOT NULL,
numbers_generated INT NOT NULL,
access_days INT NOT NULL,
version TEXT NOT NULL DEFAULT 'v1'
);

-- Insert default rule if not exists
INSERT INTO rewards.benefit_rules (min_amount, numbers_generated, access_days, version)
SELECT 0, 1, 1, 'v1'
WHERE NOT EXISTS (SELECT 1 FROM rewards.benefit_rules WHERE version = 'v1' AND min_amount = 0);