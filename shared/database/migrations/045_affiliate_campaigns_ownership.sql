-- Migration: 045_affiliate_campaigns_ownership.sql
-- Adds owner_user_id, redirect_house_id to campaigns and campaign_houses join table
-- Idempotent: uses DO $func$ blocks with tags to avoid $$ nesting

-- ============================================
-- PART 1: campaigns table modifications
-- ============================================

-- Make house_id nullable (drop NOT NULL if exists - check via information_schema)
DO $func$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'affiliate' AND table_name = 'campaigns' 
      AND column_name = 'house_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE affiliate.campaigns ALTER COLUMN house_id DROP NOT NULL;
  END IF;
END
$func$;

-- Add owner_user_id column
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'affiliate' AND table_name = 'campaigns' 
      AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE affiliate.campaigns ADD COLUMN owner_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL;
  END IF;
END
$func$;

-- Add redirect_house_id column
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'affiliate' AND table_name = 'campaigns' 
      AND column_name = 'redirect_house_id'
  ) THEN
    ALTER TABLE affiliate.campaigns ADD COLUMN redirect_house_id UUID REFERENCES affiliate.houses(id) ON DELETE SET NULL;
  END IF;
END
$func$;

-- Drop old unique constraint if exists (house_id, slug) combo
DO $func$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'affiliate' AND table_name = 'campaigns' 
      AND constraint_name = 'campaigns_house_id_slug_key'
  ) THEN
    ALTER TABLE affiliate.campaigns DROP CONSTRAINT campaigns_house_id_slug_key;
  END IF;
END
$func$;

-- Add new globally unique slug constraint
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'affiliate' AND table_name = 'campaigns' 
      AND constraint_name = 'campaigns_slug_unique'
  ) THEN
    ALTER TABLE affiliate.campaigns ADD CONSTRAINT campaigns_slug_unique UNIQUE(slug);
  END IF;
END
$func$;

-- ============================================
-- PART 2: campaign_houses join table
-- ============================================

CREATE TABLE IF NOT EXISTS affiliate.campaign_houses (
  campaign_id UUID NOT NULL REFERENCES affiliate.campaigns(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES affiliate.houses(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, house_id)
);

-- ============================================
-- PART 3: indexes
-- ============================================

CREATE INDEX IF NOT EXISTS campaigns_owner_idx 
  ON affiliate.campaigns(owner_user_id) 
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_houses_house_idx 
  ON affiliate.campaign_houses(house_id);