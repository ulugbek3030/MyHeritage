CREATE TABLE persons (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id          UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    first_name       VARCHAR(100) NOT NULL,
    last_name        VARCHAR(100),
    middle_name      VARCHAR(100),
    maiden_name      VARCHAR(100),
    gender           VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    birth_date       DATE,
    birth_year       SMALLINT,
    birth_date_known BOOLEAN NOT NULL DEFAULT FALSE,
    is_alive         BOOLEAN NOT NULL DEFAULT TRUE,
    death_date       DATE,
    death_year       SMALLINT,
    death_date_known BOOLEAN NOT NULL DEFAULT FALSE,
    photo_url        VARCHAR(500),
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_persons_tree_id ON persons(tree_id);
