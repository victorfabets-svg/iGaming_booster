-- Migration: 044_user_features.sql
-- Adds email verification to users, ticket configuration to partner_houses, and email templates system
-- Idempotent: uses DO $$ blocks to handle IF NOT EXISTS patterns

-- ============================================
-- PART 1: Users table - email verification fields
-- ============================================

-- Add email_verified column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE identity.users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END
$$;

-- Add verification_token column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'verification_token'
  ) THEN
    ALTER TABLE identity.users ADD COLUMN verification_token TEXT NULL;
  END IF;
END
$$;

-- Add verification_token_expires_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'verification_token_expires_at'
  ) THEN
    ALTER TABLE identity.users ADD COLUMN verification_token_expires_at TIMESTAMPTZ NULL;
  END IF;
END
$$;

-- Add display_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE identity.users ADD COLUMN display_name TEXT NULL;
  END IF;
END
$$;

-- Index on verification_token
CREATE INDEX IF NOT EXISTS users_verification_token_idx ON identity.users(verification_token) 
  WHERE verification_token IS NOT NULL;

-- Index on unverified users for batch operations
CREATE INDEX IF NOT EXISTS users_email_verified_idx ON identity.users(email_verified) 
  WHERE email_verified = FALSE;

-- ============================================
-- PART 2: Partner houses - ticket configuration
-- ============================================

-- Add tickets_per_deposit column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'validation' AND table_name = 'partner_houses' AND column_name = 'tickets_per_deposit'
  ) THEN
    ALTER TABLE validation.partner_houses ADD COLUMN tickets_per_deposit INT NOT NULL DEFAULT 1;
  END IF;
END
$$;

-- Add min_amount_per_ticket_cents column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'validation' AND table_name = 'partner_houses' AND column_name = 'min_amount_per_ticket_cents'
  ) THEN
    ALTER TABLE validation.partner_houses ADD COLUMN min_amount_per_ticket_cents INT NULL;
  END IF;
END
$$;

-- ============================================
-- PART 3: Notifications schema and email_templates table
-- ============================================

-- Create notifications schema if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'notifications'
  ) THEN
    CREATE SCHEMA notifications;
  END IF;
END
$$;

-- Create email_templates table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'notifications' AND table_name = 'email_templates'
  ) THEN
    CREATE TABLE notifications.email_templates (
      key TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      description TEXT,
      supported_variables TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END
$$;

-- Seed email_verification template if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM notifications.email_templates WHERE key = 'email_verification'
  ) THEN
    INSERT INTO notifications.email_templates (key, subject, html_body, description, supported_variables)
    VALUES (
      'email_verification',
      'Confirme seu email — Tipster Engine',
      '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0 0 24px 0;">Confirme seu email</h1>
      <p style="color: #4a4a68; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Olá{{#if display_name}}, {{display_name}}{{else}}!{{/if}},
      </p>
      <p style="color: #4a4a68; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
        Obrigado por se cadastrar na Tipster Engine. Por favor, confirme seu email clique no botão abaixo:
      </p>
      <a href="{{verification_url}}" style="display: inline-block; background: #FFD700; color: #1a1a2e; font-weight: 600; font-size: 16px; padding: 16px 32px; border-radius: 8px; text-decoration: none; margin-bottom: 32px;">
        Confirmar meu email
      </a>
      <p style="color: #8a8aa3; font-size: 14px; line-height: 1.6; margin: 0;">
        Se você não criou uma conta na Tipster Engine, pode ignorar este email.
      </p>
    </div>
    <p style="text-align: center; color: #8a8aa3; font-size: 12px; margin-top: 24px;">
      © 2024 Tipster Engine. Todos os direitos reservados.
    </p>
  </div>
</body>
</html>',
      'Enviado após registro do usuário. Contém link para verificação de email.',
      ARRAY['verification_url', 'display_name', 'email']
    );
  END IF;
END
$$;

-- Updated_at trigger function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'notifications' AND routine_name = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION notifications.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END
$$;

-- Create trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_schema = 'notifications' AND event_object_table = 'email_templates' AND trigger_name = 'update_email_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON notifications.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION notifications.update_updated_at_column();
  END IF;
END
$$;

-- ============================================
-- Add amount_cents to rewards.rewards for ticket calculation
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'rewards' AND table_name = 'rewards' AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE rewards.rewards ADD COLUMN amount_cents INT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'rewards' AND table_name = 'rewards' AND column_name = 'partner_house_slug'
  ) THEN
    ALTER TABLE rewards.rewards ADD COLUMN partner_house_slug TEXT NULL;
  END IF;
END
$$;