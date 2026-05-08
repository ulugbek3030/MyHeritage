-- Persons can carry a phone number. Used right now for the owner person we
-- seed from a Click SSO profile, but exposed for any person — relatives can
-- have phones too.

ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
