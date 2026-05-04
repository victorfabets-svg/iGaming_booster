-- Migration 052: contact fields on identity.users.
-- Public promo claim flow (modal on landing) collects cpf + whatsapp
-- alongside email/name. Both nullable for backward compatibility with
-- existing users created via /register. Idempotent.

ALTER TABLE identity.users
  ADD COLUMN IF NOT EXISTS cpf      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;
