-- 010_persons_address.sql
-- Add an optional "home address" field to persons. Free-form text — we don't
-- enforce a structured address schema; users can type city / street / etc.
-- however they want.

ALTER TABLE persons ADD COLUMN IF NOT EXISTS address TEXT;
