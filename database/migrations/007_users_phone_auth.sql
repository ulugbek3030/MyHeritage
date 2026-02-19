-- Migration: Switch from email-based to phone-based authentication
-- Also removes display_name from users table (name lives on person record)

-- Clean existing data (schema change is incompatible with existing records)
DELETE FROM trees;  -- CASCADE handles persons, relationships
DELETE FROM users;

-- Drop old email column and index
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;

-- Add phone column
ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE NOT NULL;
CREATE INDEX idx_users_phone ON users(phone);
