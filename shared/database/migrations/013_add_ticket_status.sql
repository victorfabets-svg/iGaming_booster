-- Add status column to raffles.tickets for tracking ticket lifecycle

ALTER TABLE raffles.tickets 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_raffles_tickets_status ON raffles.tickets(status);
CREATE INDEX IF NOT EXISTS idx_raffles_tickets_proof_id ON raffles.tickets(proof_id);