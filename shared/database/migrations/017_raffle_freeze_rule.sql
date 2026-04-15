-- Enforce ticket creation only when raffle is active
-- This prevents tickets from being inserted after raffle is closed

CREATE OR REPLACE FUNCTION prevent_ticket_after_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM raffles.raffles
    WHERE id = NEW.raffle_id
      AND status = 'active'
      AND NOW() BETWEEN start_at AND end_at
  ) THEN
    RAISE EXCEPTION 'Cannot create ticket: raffle not active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tickets table
DROP TRIGGER IF EXISTS check_raffle_active ON raffles.tickets;

CREATE TRIGGER check_raffle_active
BEFORE INSERT ON raffles.tickets
FOR EACH ROW
EXECUTE FUNCTION prevent_ticket_after_close();