CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('couple','parent_child')),
  person1_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  couple_status VARCHAR(20) CHECK (couple_status IN ('married','civil','dating','divorced','widowed','other')),
  child_relation VARCHAR(20) CHECK (child_relation IN ('biological','adopted','foster','guardianship','stepchild')),
  start_date DATE,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT diff_persons CHECK (person1_id <> person2_id),
  CONSTRAINT couple_consistency CHECK (
    (category = 'couple' AND couple_status IS NOT NULL AND child_relation IS NULL) OR
    (category = 'parent_child' AND child_relation IS NOT NULL AND couple_status IS NULL)
  )
);

CREATE INDEX idx_rel_tree_id ON relationships(tree_id);
CREATE INDEX idx_rel_p1 ON relationships(person1_id);
CREATE INDEX idx_rel_p2 ON relationships(person2_id);
