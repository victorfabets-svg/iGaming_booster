-- Migration 051: configurable CTA + image/video creative on promotions.
-- Idempotent.

-- CTA: text + URL (free-form so a single creative can drive a deposit
-- redirect, a WhatsApp join, a Telegram bot, etc., depending on the
-- campaign). Both nullable — landing falls back to /r/p/:slug if unset.
ALTER TABLE promotions.promotions
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS cta_url   TEXT;

-- Creative type lets the landing render the right element. 'video' must
-- be muted/autoplay-friendly; the player tag handles that on the client.
ALTER TABLE promotions.promotions
  ADD COLUMN IF NOT EXISTS creative_type TEXT NOT NULL DEFAULT 'image';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_schema = 'promotions'
       AND table_name = 'promotions'
       AND constraint_name = 'promotions_creative_type_check'
  ) THEN
    ALTER TABLE promotions.promotions
      ADD CONSTRAINT promotions_creative_type_check
      CHECK (creative_type IN ('image', 'video'));
  END IF;
END$$;
