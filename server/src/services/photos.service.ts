import path from 'path';
import fs from 'fs';
import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export async function uploadPhoto(treeId: string, personId: string, file: Express.Multer.File) {
  // Verify person exists
  const personRes = await query(
    'SELECT id, photo_url FROM persons WHERE id = $1 AND tree_id = $2',
    [personId, treeId]
  );
  if (personRes.rows.length === 0) throw new NotFoundError('Person');

  // Delete old photo if exists
  const oldUrl = personRes.rows[0].photo_url;
  if (oldUrl && oldUrl.startsWith('/uploads/')) {
    const oldPath = path.join(UPLOADS_DIR, '..', oldUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  // Ensure directory exists
  const dir = path.join(UPLOADS_DIR, treeId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Move file
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${personId}${ext}`;
  const dest = path.join(dir, filename);
  fs.renameSync(file.path, dest);

  // Update person
  const photoUrl = `/uploads/${treeId}/${filename}`;
  await query(
    'UPDATE persons SET photo_url = $1, updated_at = NOW() WHERE id = $2',
    [photoUrl, personId]
  );

  return { photoUrl };
}

export async function deletePhoto(treeId: string, personId: string) {
  const personRes = await query(
    'SELECT id, photo_url FROM persons WHERE id = $1 AND tree_id = $2',
    [personId, treeId]
  );
  if (personRes.rows.length === 0) throw new NotFoundError('Person');

  const photoUrl = personRes.rows[0].photo_url;
  if (photoUrl && photoUrl.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, '..', photoUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await query(
    'UPDATE persons SET photo_url = NULL, updated_at = NOW() WHERE id = $1',
    [personId]
  );

  return { deleted: true };
}
