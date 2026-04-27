-- Migration: 043_users_role.sql
-- Adds role column to users table with 'user' as default
-- Roles: user, admin, affiliate
-- Idempotent: uses DO $$ blocks to handle IF NOT EXISTS patterns

-- Add role column with default 'user'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'identity' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE identity.users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;
END
$$;

-- Add check constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'identity' AND table_name = 'users' AND constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE identity.users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'affiliate'));
  END IF;
END
$$;

-- Create index for non-user roles (admin and affiliate queries)
CREATE INDEX IF NOT EXISTS users_role_idx ON identity.users(role) WHERE role <> 'user';