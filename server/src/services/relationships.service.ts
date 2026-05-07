import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

const F = `id, tree_id AS "treeId", category, person1_id AS "person1Id", person2_id AS "person2Id",
           couple_status AS "coupleStatus", child_relation AS "childRelation",
           start_date AS "startDate", end_date AS "endDate", note`;

export const listRels = async (treeId: string) => (await query<any>(`SELECT ${F} FROM relationships WHERE tree_id = $1`, [treeId])).rows;
export const getRel = async (id: string) => {
  const r = await query<any>(`SELECT ${F} FROM relationships WHERE id = $1`, [id]);
  if (r.rowCount === 0) throw new NotFoundError('Relationship not found');
  return r.rows[0];
};
export const createRel = async (treeId: string, b: any) => {
  const r = await query<any>(`INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status, child_relation, start_date, end_date, note)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${F}`,
    [treeId, b.category, b.person1Id, b.person2Id, b.coupleStatus ?? null, b.childRelation ?? null, b.startDate ?? null, b.endDate ?? null, b.note ?? null]);
  return r.rows[0];
};
export const updateRel = async (id: string, b: any) => {
  const map: Record<string,string> = { category:'category', coupleStatus:'couple_status', childRelation:'child_relation', startDate:'start_date', endDate:'end_date', note:'note' };
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  for (const [k,v] of Object.entries(b)) if (map[k]) { sets.push(`${map[k]}=$${i++}`); params.push(v); }
  if (!sets.length) return getRel(id);
  params.push(id);
  const r = await query<any>(`UPDATE relationships SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${i} RETURNING ${F}`, params);
  return r.rows[0];
};
export const deleteRel = async (id: string) => { await query(`DELETE FROM relationships WHERE id = $1`, [id]); };
