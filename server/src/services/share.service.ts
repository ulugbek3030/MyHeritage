import { customAlphabet } from 'nanoid';
import { query } from '../db/pool.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { getFullTree } from './trees.service.js';

const tokenGen = customAlphabet('abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

export interface ShareSettings { showBirthDates: boolean; showPhotos: boolean; allowSuggestions: boolean; }
const DEFAULTS: ShareSettings = { showBirthDates: true, showPhotos: true, allowSuggestions: false };

export const enableShare = async (treeId: string, settings: Partial<ShareSettings> = {}): Promise<{ token: string; settings: ShareSettings }> => {
  const merged = { ...DEFAULTS, ...settings };
  const token = tokenGen();
  await query(`UPDATE trees SET share_token = $1, share_settings = $2, visibility = COALESCE(NULLIF(visibility, 'private'), 'link') WHERE id = $3`,
    [token, JSON.stringify(merged), treeId]);
  return { token, settings: merged };
};

export const updateShareSettings = async (treeId: string, settings: Partial<ShareSettings>) => {
  const r = await query<any>(`SELECT share_settings FROM trees WHERE id = $1`, [treeId]);
  if (r.rowCount === 0) throw new NotFoundError('Tree not found');
  const merged = { ...DEFAULTS, ...r.rows[0].share_settings, ...settings };
  await query(`UPDATE trees SET share_settings = $1 WHERE id = $2`, [JSON.stringify(merged), treeId]);
  return merged;
};

export const disableShare = async (treeId: string) => {
  await query(`UPDATE trees SET share_token = NULL, visibility = 'private' WHERE id = $1`, [treeId]);
};

export const getPublicView = async (token: string) => {
  const r = await query<any>(
    `SELECT id, visibility, share_settings FROM trees WHERE share_token = $1`, [token]);
  if (r.rowCount === 0) throw new NotFoundError('Share link not found');
  if (r.rows[0].visibility === 'private') throw new ForbiddenError('Sharing disabled');
  const settings: ShareSettings = { ...DEFAULTS, ...r.rows[0].share_settings };
  const full = await getFullTree(r.rows[0].id);
  // Apply privacy filters
  if (!settings.showBirthDates) {
    full.persons = full.persons.map((p: any) => ({ ...p, birth_date: null, birth_year: null, birth_date_known: false, death_date: null, death_year: null }));
  }
  if (!settings.showPhotos) {
    full.persons = full.persons.map((p: any) => ({ ...p, photoUrl: null }));
  }
  return { tree: { id: full.tree.id, name: full.tree.name }, persons: full.persons, relationships: full.relationships, generations: full.generations, settings };
};
