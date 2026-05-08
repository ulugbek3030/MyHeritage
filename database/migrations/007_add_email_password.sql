-- Email + password as a second login option alongside phone-OTP and Click SSO.
-- Existing users keep working: phone is now nullable so email-only signups
-- can also live in the same row, and the CHECK constraint guarantees every
-- user still has at least one identifier.

CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE users
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email CITEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Partial unique index — multiple email-NULL rows are fine (phone-only users).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE email IS NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_have_identifier;
ALTER TABLE users
  ADD CONSTRAINT users_have_identifier
  CHECK (email IS NOT NULL OR phone IS NOT NULL);
