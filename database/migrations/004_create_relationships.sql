CREATE TYPE relationship_category AS ENUM ('couple', 'parent_child');

CREATE TYPE couple_type AS ENUM (
    'married',
    'civil',
    'dating',
    'divorced',
    'widowed',
    'other'
);

CREATE TYPE child_type AS ENUM (
    'biological',
    'adopted',
    'foster',
    'guardianship',
    'stepchild'
);

CREATE TABLE relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id         UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    category        relationship_category NOT NULL,
    person1_id      UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    person2_id      UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    couple_status   couple_type,
    child_relation  child_type,
    start_date      DATE,
    end_date        DATE,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_different_persons CHECK (person1_id != person2_id),
    CONSTRAINT chk_type_fields CHECK (
        (category = 'couple' AND couple_status IS NOT NULL AND child_relation IS NULL) OR
        (category = 'parent_child' AND child_relation IS NOT NULL AND couple_status IS NULL)
    )
);

CREATE INDEX idx_relationships_tree_id ON relationships(tree_id);
CREATE INDEX idx_relationships_person1 ON relationships(person1_id);
CREATE INDEX idx_relationships_person2 ON relationships(person2_id);
CREATE INDEX idx_relationships_category ON relationships(category);
