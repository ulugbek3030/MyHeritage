import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

export const setPhoto = async (personId: string, data: Buffer, mime: string) => {
  await query(`UPDATE persons SET photo_data = $1, photo_mime = $2, updated_at = NOW() WHERE id = $3`, [data, mime, personId]);
};

export const getPhoto = async (personId: string): Promise<{ data: Buffer; mime: string } | null> => {
  const r = await query<any>(
    `SELECT photo_data, photo_mime FROM persons WHERE id = $1`, [personId]);
  if (r.rowCount === 0) throw new NotFoundError('Person not found');
  if (!r.rows[0].photo_data) return null;
  return { data: r.rows[0].photo_data, mime: r.rows[0].photo_mime };
};

export const deletePhoto = async (personId: string) => {
  await query(`UPDATE persons SET photo_data = NULL, photo_mime = NULL, updated_at = NOW() WHERE id = $1`, [personId]);
};
