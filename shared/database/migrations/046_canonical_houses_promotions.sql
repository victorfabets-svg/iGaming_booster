-- Migration 046: canonical houses + promotions + repescagem schema
-- Creates unified house canonical source (core.houses) and promotions layer
-- Idempotent: uses DO $func$ blocks with tags to avoid $$ nesting

-- ============================================
-- PART 1: Schema core + core.houses table
-- ============================================

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.houses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  country     TEXT NOT NULL,
  currency    TEXT NOT NULL,
  deposit_url TEXT NOT NULL DEFAULT '',
  signup_url  TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS core_houses_active_idx ON core.houses(active) WHERE active = true;

-- ============================================
-- PART 2: Backfill core.houses from existing tables
-- ============================================

-- Insere a partir de validation.partner_houses primeiro (tem country/currency)
INSERT INTO core.houses (slug, name, country, currency, deposit_url, signup_url, active)
SELECT
  vph.slug,
  vph.name,
  vph.country,
  vph.currency,
  '',
  ah.base_url,
  COALESCE(vph.active, ah.active, true)
FROM validation.partner_houses vph
LEFT JOIN affiliate.houses ah ON ah.slug = vph.slug
ON CONFLICT (slug) DO NOTHING;

-- Insere as casas de affiliate.houses que não estão em partner_houses
INSERT INTO core.houses (slug, name, country, currency, deposit_url, signup_url, active)
SELECT
  ah.slug,
  ah.name,
  'BR',
  'BRL',
  '',
  ah.base_url,
  ah.active
FROM affiliate.houses ah
WHERE NOT EXISTS (SELECT 1 FROM core.houses ch WHERE ch.slug = ah.slug)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- PART 3: Add house_id FK to affiliate.houses
-- ============================================

DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'affiliate' AND table_name = 'houses' AND column_name = 'house_id'
  ) THEN
    ALTER TABLE affiliate.houses
      ADD COLUMN house_id UUID REFERENCES core.houses(id);
  END IF;
END
$func$;

UPDATE affiliate.houses ah
   SET house_id = ch.id
  FROM core.houses ch
 WHERE ch.slug = ah.slug
   AND ah.house_id IS NULL;

CREATE INDEX IF NOT EXISTS affiliate_houses_house_id_idx ON affiliate.houses(house_id);

-- ============================================
-- PART 4: Add house_id FK to validation.partner_houses
-- ============================================

DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'validation' AND table_name = 'partner_houses' AND column_name = 'house_id'
  ) THEN
    ALTER TABLE validation.partner_houses
      ADD COLUMN house_id UUID REFERENCES core.houses(id);
  END IF;
END
$func$;

UPDATE validation.partner_houses vph
   SET house_id = ch.id
  FROM core.houses ch
 WHERE ch.slug = vph.slug
   AND vph.house_id IS NULL;

CREATE INDEX IF NOT EXISTS partner_houses_house_id_idx ON validation.partner_houses(house_id);

-- ============================================
-- PART 5: Schema promotions + promotions table
-- ============================================

CREATE SCHEMA IF NOT EXISTS promotions;

CREATE TABLE IF NOT EXISTS promotions.promotions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  creative_url          TEXT,
  house_id              UUID NOT NULL REFERENCES core.houses(id),
  raffle_id             UUID NOT NULL REFERENCES raffles.raffles(id),
  starts_at             TIMESTAMP NOT NULL,
  ends_at               TIMESTAMP NOT NULL,
  draw_at               TIMESTAMP NOT NULL,
  repescagem            BOOLEAN NOT NULL DEFAULT false,
  repescagem_applied_at TIMESTAMP,
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (ends_at >= starts_at),
  CHECK (draw_at >= ends_at)
);

CREATE INDEX IF NOT EXISTS promotions_active_idx ON promotions.promotions(active, starts_at, ends_at) WHERE active = true;
CREATE INDEX IF NOT EXISTS promotions_house_idx ON promotions.promotions(house_id);
CREATE INDEX IF NOT EXISTS promotions_raffle_idx ON promotions.promotions(raffle_id);

-- ============================================
-- PART 6: Tiers table
-- ============================================

CREATE TABLE IF NOT EXISTS promotions.tiers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id      UUID NOT NULL REFERENCES promotions.promotions(id) ON DELETE CASCADE,
  min_deposit_cents INTEGER NOT NULL CHECK (min_deposit_cents >= 0),
  tickets           INTEGER NOT NULL CHECK (tickets > 0),
  UNIQUE (promotion_id, min_deposit_cents)
);

CREATE INDEX IF NOT EXISTS promotions_tiers_promo_idx ON promotions.tiers(promotion_id, min_deposit_cents DESC);

-- ============================================
-- PART 7: Repescagem sources + invitations
-- ============================================

CREATE TABLE IF NOT EXISTS promotions.repescagem_sources (
  promotion_id        UUID NOT NULL REFERENCES promotions.promotions(id) ON DELETE CASCADE,
  source_promotion_id UUID NOT NULL REFERENCES promotions.promotions(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, source_promotion_id),
  CHECK (promotion_id <> source_promotion_id)
);

CREATE TABLE IF NOT EXISTS promotions.repescagem_invitations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id        UUID NOT NULL REFERENCES promotions.promotions(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  source_promotion_id UUID NOT NULL REFERENCES promotions.promotions(id),
  status              TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  decided_at          TIMESTAMP,
  UNIQUE (promotion_id, user_id)
);

CREATE INDEX IF NOT EXISTS repescagem_invitations_user_idx
  ON promotions.repescagem_invitations(user_id, status);
CREATE INDEX IF NOT EXISTS repescagem_invitations_promo_idx
  ON promotions.repescagem_invitations(promotion_id, status);