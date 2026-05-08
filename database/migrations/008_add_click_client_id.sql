-- Persist the Click SuperApp identifier on the user row so the SSO upsert can
-- key off something Click owns (client_id) rather than phone — Click's
-- phone_number can change (number ports), client_id is permanent.
-- click_profile keeps the last-known profile JSON so we can later seed the
-- owner's person card with patronym/gender without an extra Click round-trip.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS click_client_id BIGINT,
  ADD COLUMN IF NOT EXISTS click_profile JSONB,
  ADD COLUMN IF NOT EXISTS click_synced_at TIMESTAMPTZ;

-- Partial unique index — multiple non-Click users (email/phone-only) all sit
-- with NULL click_client_id and that's fine.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_click_client_id
  ON users(click_client_id) WHERE click_client_id IS NOT NULL;

-- Loosen the identifier CHECK so a Click-only user (no phone, no email) is
-- still valid — Click profiles always include phone in practice, but this
-- keeps the constraint honest.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_have_identifier;
ALTER TABLE users
  ADD CONSTRAINT users_have_identifier
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR click_client_id IS NOT NULL);
