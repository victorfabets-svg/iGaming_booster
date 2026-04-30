-- Migration 047: tickets.source + nullable proof/reward + repescagem invitation link
-- Allows raffles.tickets to come from two sources: 'proof' (regular flow) or 'repescagem'
-- (invitation accepted by user). Repescagem tickets don't have proof/reward.
-- Idempotent: uses DO $func$ blocks with tags to avoid $$ nesting.

-- 1. Add 'source' column with check constraint
ALTER TABLE raffles.tickets ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'proof'
  CHECK (source IN ('proof', 'repescagem'));

-- 2. Drop NOT NULL on proof_id (repescagem tickets won't have proof)
DO $func$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'raffles' AND table_name = 'tickets'
      AND column_name = 'proof_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE raffles.tickets ALTER COLUMN proof_id DROP NOT NULL;
  END IF;
END
$func$;

-- 3. Drop NOT NULL on reward_id (same reason)
DO $func$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'raffles' AND table_name = 'tickets'
      AND column_name = 'reward_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE raffles.tickets ALTER COLUMN reward_id DROP NOT NULL;
  END IF;
END
$func$;

-- 4. Add row-level guard: 'proof' source must have proof_id and reward_id;
--    'repescagem' may have NULL on both
DO $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'raffles'
      AND table_name = 'tickets'
      AND constraint_name = 'tickets_source_consistency_check'
  ) THEN
    ALTER TABLE raffles.tickets ADD CONSTRAINT tickets_source_consistency_check
      CHECK (
        (source = 'proof' AND proof_id IS NOT NULL AND reward_id IS NOT NULL)
        OR
        (source = 'repescagem')
      );
  END IF;
END
$func$;

-- 5. Link repescagem tickets back to their invitation (idempotency for accept)
ALTER TABLE raffles.tickets
  ADD COLUMN IF NOT EXISTS repescagem_invitation_id UUID
  REFERENCES promotions.repescagem_invitations(id);

CREATE UNIQUE INDEX IF NOT EXISTS tickets_repescagem_invitation_unique
  ON raffles.tickets(repescagem_invitation_id) WHERE repescagem_invitation_id IS NOT NULL;

-- 6. Trace which promotion generated the ticket (for proof-source tickets)
ALTER TABLE raffles.tickets
  ADD COLUMN IF NOT EXISTS promotion_id UUID
  REFERENCES promotions.promotions(id);

CREATE INDEX IF NOT EXISTS tickets_promotion_idx
  ON raffles.tickets(promotion_id) WHERE promotion_id IS NOT NULL;
