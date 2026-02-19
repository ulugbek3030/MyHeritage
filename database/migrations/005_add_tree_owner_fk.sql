ALTER TABLE trees ADD CONSTRAINT fk_trees_owner_person
    FOREIGN KEY (owner_person_id) REFERENCES persons(id) ON DELETE SET NULL;
