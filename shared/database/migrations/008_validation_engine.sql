-- Migration: 008b_validation_engine.sql
-- VALIDATION ENGINE MIGRATION
-- Adds unique constraint on proof_id for idempotency

-- Add unique constraint to proof_validations table
ALTER TABLE validation.proof_validations 
ADD CONSTRAINT proof_validations_proof_id_unique UNIQUE (proof_id);