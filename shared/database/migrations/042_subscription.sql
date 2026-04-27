CREATE SCHEMA IF NOT EXISTS subscription;

CREATE TABLE IF NOT EXISTS subscription.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency CHAR(3) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_active 
  ON subscription.plans(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS subscription.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT UNIQUE NOT NULL,
  user_id UUID,
  plan_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'canceled', 'expired')),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,
  expired_at TIMESTAMP,
  amount_cents INTEGER,
  currency CHAR(3),
  provider TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
  ON subscription.subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
  ON subscription.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end 
  ON subscription.subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_slug 
  ON subscription.subscriptions(plan_slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at 
  ON subscription.subscriptions(created_at);

CREATE TABLE IF NOT EXISTS subscription.webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at 
  ON subscription.webhook_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider 
  ON subscription.webhook_events(provider);