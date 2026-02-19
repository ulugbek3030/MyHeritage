-- Store photos as binary data in PostgreSQL instead of filesystem
-- This ensures photos survive container redeployments (Render ephemeral FS)

ALTER TABLE persons ADD COLUMN IF NOT EXISTS photo_data BYTEA;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS photo_mime VARCHAR(50);

-- Clear old filesystem-based photo_url values (files already lost on redeploy)
UPDATE persons SET photo_url = NULL WHERE photo_url LIKE '/uploads/%';
