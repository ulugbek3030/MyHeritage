-- 012_tree_access_requests.sql
-- Two pieces of "Расширить древо" infrastructure:
--   1. users.is_identified — stamped from Click's profile during SSO. Only
--      identified Click users can request access to another user's tree
--      (Click KYC requirement).
--   2. tree_access_requests — pending / accepted / declined requests between
--      two users. Approval grants RECIPROCAL tree-view access: requester sees
--      target's tree AND target sees requester's tree. The granted access
--      lives in tree_access_grants (separate table so revocation is cheap and
--      the request history stays around).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_identified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS tree_access_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- target may be NULL if we couldn't resolve the phone to an existing user.
  -- It can be filled in later when the target signs in for the first time.
  target_phone    TEXT NOT NULL,
  target_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'))
                                DEFAULT 'pending',
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  CONSTRAINT no_self_request CHECK (target_user_id IS NULL OR target_user_id <> requester_id)
);

CREATE INDEX IF NOT EXISTS idx_tar_requester ON tree_access_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_tar_target_user ON tree_access_requests(target_user_id, status)
  WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tar_target_phone ON tree_access_requests(target_phone, status);

-- Pending requests are unique per (requester, target) pair so a user can't
-- spam the same person with multiple open requests. A previously declined or
-- cancelled request doesn't block re-requesting.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tar_unique_pending
  ON tree_access_requests(requester_id, COALESCE(target_user_id::text, target_phone))
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS tree_access_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id  UUID REFERENCES tree_access_requests(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_grant CHECK (user_a_id <> user_b_id)
);

-- One grant per ordered pair (a → b can see b's tree). The reciprocal grant
-- (b → a) is a SEPARATE row, inserted at the same time on approval.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_unique_pair
  ON tree_access_grants(user_a_id, user_b_id);
