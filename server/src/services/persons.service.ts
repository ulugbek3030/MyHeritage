import { query, getClient } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

interface CreatePersonData {
  firstName: string;
  lastName?: string | null;
  middleName?: string | null;
  maidenName?: string | null;
  gender: string;
  birthDate?: string | null;
  birthYear?: number | null;
  birthDateKnown?: boolean;
  isAlive?: boolean;
  deathDate?: string | null;
  deathYear?: number | null;
  deathDateKnown?: boolean;
  note?: string | null;
  relationships?: {
    category: string;
    relatedPersonId: string;
    coupleStatus?: string;
    childRelation?: string;
  }[];
}

function mapRow(r: any) {
  return {
    id: r.id,
    treeId: r.tree_id,
    firstName: r.first_name,
    lastName: r.last_name,
    middleName: r.middle_name,
    maidenName: r.maiden_name,
    gender: r.gender,
    birthDate: r.birth_date,
    birthYear: r.birth_year,
    birthDateKnown: r.birth_date_known,
    isAlive: r.is_alive,
    deathDate: r.death_date,
    deathYear: r.death_year,
    deathDateKnown: r.death_date_known,
    photoUrl: r.photo_url,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listPersons(treeId: string) {
  const result = await query(
    `SELECT * FROM persons WHERE tree_id = $1 ORDER BY created_at`,
    [treeId]
  );
  return result.rows.map(mapRow);
}

export async function createPerson(treeId: string, data: CreatePersonData) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO persons (tree_id, first_name, last_name, middle_name, maiden_name, gender,
         birth_date, birth_year, birth_date_known, is_alive, death_date, death_year, death_date_known, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        treeId,
        data.firstName,
        data.lastName || null,
        data.middleName || null,
        data.maidenName || null,
        data.gender,
        data.birthDate || null,
        data.birthYear || null,
        data.birthDateKnown || false,
        data.isAlive !== undefined ? data.isAlive : true,
        data.deathDate || null,
        data.deathYear || null,
        data.deathDateKnown || false,
        data.note || null,
      ]
    );

    const person = result.rows[0];

    // Create relationships if provided
    if (data.relationships && data.relationships.length > 0) {
      for (const rel of data.relationships) {
        if (rel.category === 'couple') {
          await client.query(
            `INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status)
             VALUES ($1, 'couple', $2, $3, $4)`,
            [treeId, person.id, rel.relatedPersonId, rel.coupleStatus || 'married']
          );
        } else if (rel.category === 'parent_child') {
          // relatedPersonId is the parent, new person is the child
          await client.query(
            `INSERT INTO relationships (tree_id, category, person1_id, person2_id, child_relation)
             VALUES ($1, 'parent_child', $2, $3, $4)`,
            [treeId, rel.relatedPersonId, person.id, rel.childRelation || 'biological']
          );
        }
      }
    }

    await client.query('COMMIT');
    return mapRow(person);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPerson(treeId: string, personId: string) {
  const result = await query(
    'SELECT * FROM persons WHERE id = $1 AND tree_id = $2',
    [personId, treeId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Person');
  return mapRow(result.rows[0]);
}

export async function updatePerson(treeId: string, personId: string, data: Partial<CreatePersonData>) {
  const fieldMap: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    middleName: 'middle_name',
    maidenName: 'maiden_name',
    gender: 'gender',
    birthDate: 'birth_date',
    birthYear: 'birth_year',
    birthDateKnown: 'birth_date_known',
    isAlive: 'is_alive',
    deathDate: 'death_date',
    deathYear: 'death_year',
    deathDateKnown: 'death_date_known',
    note: 'note',
  };

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push((data as any)[key]);
    }
  }

  if (sets.length === 0) return getPerson(treeId, personId);

  sets.push('updated_at = NOW()');
  params.push(personId, treeId);

  const result = await query(
    `UPDATE persons SET ${sets.join(', ')}
     WHERE id = $${idx} AND tree_id = $${idx + 1}
     RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Person');
  return mapRow(result.rows[0]);
}

export async function deletePerson(treeId: string, personId: string) {
  // Also unset owner_person_id if this person was the owner
  await query(
    'UPDATE trees SET owner_person_id = NULL WHERE id = $1 AND owner_person_id = $2',
    [treeId, personId]
  );

  const result = await query(
    'DELETE FROM persons WHERE id = $1 AND tree_id = $2 RETURNING id',
    [personId, treeId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Person');
  return { deleted: true };
}
