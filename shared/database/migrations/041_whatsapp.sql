-- Migration 041: WhatsApp Platform Integration
-- Creates schema and tables for WhatsApp subscriber management and delivery tracking

CREATE SCHEMA IF NOT EXISTS whatsapp;

CREATE TABLE IF NOT EXISTS whatsapp.subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  phone_number TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  language CHAR(2) NOT NULL DEFAULT 'pt',
  opted_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
  opted_out_at TIMESTAMP,
  opt_out_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_active 
  ON whatsapp.subscribers(opted_out_at) WHERE opted_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id 
  ON whatsapp.subscribers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_created_at 
  ON whatsapp.subscribers(created_at);

CREATE TABLE IF NOT EXISTS whatsapp.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tip_id UUID,
  subscriber_id UUID NOT NULL REFERENCES whatsapp.subscribers(id),
  message_type TEXT NOT NULL 
    CHECK (message_type IN ('tip_alert', 'settlement_alert')),
  status TEXT NOT NULL 
    CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMP NOT NULL,
  error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tip_id, subscriber_id, message_type)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_tip_id ON whatsapp.deliveries(tip_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_subscriber_id ON whatsapp.deliveries(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON whatsapp.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON whatsapp.deliveries(created_at);