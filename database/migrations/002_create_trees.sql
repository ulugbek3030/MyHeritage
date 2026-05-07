CREATE TABLE trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  owner_person_id UUID,
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','link','family','public')),
  share_token VARCHAR(16) UNIQUE,
  share_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trees_user_id ON trees(user_id);
CREATE INDEX idx_trees_share_token ON trees(share_token) WHERE share_token IS NOT NULL;
