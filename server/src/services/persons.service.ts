import { pool, query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

const PERSON_FIELDS = `
  id, tree_id AS "treeId", first_name AS "firstName", last_name AS "lastName",
  middle_name AS "middleName", maiden_name AS "maidenName", gender,
  birth_date AS "birthDate", birth_year AS "birthYear", birth_date_known AS "birthDateKnown",
  is_alive AS "isAlive", death_date AS "deathDate", death_year AS "deathYear",
  death_date_known AS "deathDateKnown", verified, note,
  CASE WHEN photo_data IS NOT NULL THEN '/api/trees/' || tree_id || '/persons/' || id || '/photo' ELSE NULL END AS "photoUrl"
`;

export const listPersons = async (treeId: string) => {
  const r = await query<any>(`SELECT ${PERSON_FIELDS} FROM persons WHERE tree_id = $1 ORDER BY birth_year NULLS LAST, birth_date NULLS LAST`, [treeId]);
  return r.rows;
};

export const getPerson = async (id: string) => {
  const r = await query<any>(`SELECT ${PERSON_FIELDS} FROM persons WHERE id = $1`, [id]);
  if (r.rowCount === 0) throw new NotFoundError('Person not found');
  return r.rows[0];
};

interface CreatePersonInput {
  firstName: string; lastName?: string; middleName?: string; maidenName?: string;
  gender: 'male' | 'female';
  birthDate?: string; birthYear?: number; birthDateKnown?: boolean;
  isAlive?: boolean; deathDate?: string; deathYear?: number; deathDateKnown?: boolean;
  note?: string;
  relationships?: Array<{
    category: 'couple' | 'parent_child';
    otherPersonId: string;
    role?: 'parent' | 'child' | 'spouse';
    coupleStatus?: string;
    childRelation?: string;
  }>;
}

export const createPerson = async (treeId: string, input: CreatePersonInput) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const insP = await c.query(
      `INSERT INTO persons (tree_id, first_name, last_name, middle_name, maiden_name, gender, birth_date, birth_year, birth_date_known, is_alive, death_date, death_year, death_date_known, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING ${PERSON_FIELDS}`,
      [treeId, input.firstName, input.lastName ?? null, input.middleName ?? null, input.maidenName ?? null,
       input.gender, input.birthDate ?? null, input.birthYear ?? null, input.birthDateKnown ?? false,
       input.isAlive ?? true, input.deathDate ?? null, input.deathYear ?? null, input.deathDateKnown ?? false, input.note ?? null]
    );
    const newPerson = insP.rows[0];

    for (const r of input.relationships ?? []) {
      let p1: string, p2: string;
      if (r.role === 'parent') { p1 = r.otherPersonId; p2 = newPerson.id; }
      else if (r.role === 'child') { p1 = newPerson.id; p2 = r.otherPersonId; }
      else { p1 = newPerson.id; p2 = r.otherPersonId; }
      await c.query(
        `INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status, child_relation)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [treeId, r.category, p1, p2, r.coupleStatus ?? null, r.childRelation ?? null]
      );
    }
    await c.query('COMMIT');
    return newPerson;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

export const updatePerson = async (id: string, fields: Partial<CreatePersonInput>) => {
  const map: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', middleName: 'middle_name', maidenName: 'maiden_name', gender: 'gender', birthDate: 'birth_date', birthYear: 'birth_year', birthDateKnown: 'birth_date_known', isAlive: 'is_alive', deathDate: 'death_date', deathYear: 'death_year', deathDateKnown: 'death_date_known', note: 'note' };
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'relationships' || !map[k]) continue;
    sets.push(`${map[k]} = $${i++}`); params.push(v ?? null);
  }
  if (sets.length === 0) return getPerson(id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const r = await query<any>(`UPDATE persons SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${PERSON_FIELDS}`, params);
  if (r.rowCount === 0) throw new NotFoundError('Person not found');
  return r.rows[0];
};

export const deletePerson = async (id: string): Promise<void> => {
  await query(`DELETE FROM persons WHERE id = $1`, [id]);
};
