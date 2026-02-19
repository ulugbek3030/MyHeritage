import fs from 'fs';
import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * Upload photo — store binary data directly in PostgreSQL.
 * No filesystem dependency — survives container redeployments.
 */
export async function uploadPhoto(treeId: string, personId: string, file: Express.Multer.File) {
  // Verify person exists
  const personRes = await query(
    'SELECT id FROM persons WHERE id = $1 AND tree_id = $2',
    [personId, treeId]
  );
  if (personRes.rows.length === 0) throw new NotFoundError('Person');

  // Read file from multer temp location
  const photoData = fs.readFileSync(file.path);

  // Clean up temp file
  try { fs.unlinkSync(file.path); } catch { /* ignore */ }

  // Store in database
  const photoUrl = `/api/trees/${treeId}/persons/${personId}/photo`;
  await query(
    `UPDATE persons
     SET photo_data = $1, photo_mime = $2, photo_url = $3, updated_at = NOW()
     WHERE id = $4`,
    [photoData, file.mimetype, photoUrl, personId]
  );

  return { photoUrl };
}

/**
 * Get photo binary data from database.
 */
export async function getPhoto(treeId: string, personId: string) {
  const res = await query(
    'SELECT photo_data, photo_mime FROM persons WHERE id = $1 AND tree_id = $2',
    [personId, treeId]
  );
  if (res.rows.length === 0) throw new NotFoundError('Person');

  const { photo_data, photo_mime } = res.rows[0];
  if (!photo_data) return null;

  return { data: photo_data as Buffer, mime: photo_mime as string };
}

/**
 * Delete photo — clear binary data from database.
 */
export async function deletePhoto(treeId: string, personId: string) {
  const personRes = await query(
    'SELECT id FROM persons WHERE id = $1 AND tree_id = $2',
    [personId, treeId]
  );
  if (personRes.rows.length === 0) throw new NotFoundError('Person');

  await query(
    'UPDATE persons SET photo_data = NULL, photo_mime = NULL, photo_url = NULL, updated_at = NOW() WHERE id = $1',
    [personId]
  );

  return { deleted: true };
}
