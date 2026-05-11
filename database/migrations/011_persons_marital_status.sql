-- 011_persons_marital_status.sql
-- Add a free-text marital_status field to persons. UI offers a fixed set of
-- options (married/divorced/separated/widowed/engaged/spouse/dating/annulled/
-- unknown/other) but the column is plain TEXT to keep adding/translating
-- options later painless.

ALTER TABLE persons ADD COLUMN IF NOT EXISTS marital_status TEXT;
