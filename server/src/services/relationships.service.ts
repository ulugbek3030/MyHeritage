import { query } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

function mapRow(r: any) {
  return {
    id: r.id,
    treeId: r.tree_id,
    category: r.category,
    person1Id: r.person1_id,
    person2Id: r.person2_id,
    coupleStatus: r.couple_status,
    childRelation: r.child_relation,
    startDate: r.start_date,
    endDate: r.end_date,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listRelationships(treeId: string) {
  const result = await query(
    'SELECT * FROM relationships WHERE tree_id = $1 ORDER BY created_at',
    [treeId]
  );
  return result.rows.map(mapRow);
}

export async function createRelationship(treeId: string, data: {
  category: string;
  person1Id: string;
  person2Id: string;
  coupleStatus?: string;
  childRelation?: string;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
}) {
  // Validate category-specific fields
  if (data.category === 'couple' && !data.coupleStatus) {
    throw new ValidationError('coupleStatus is required for couple relationships');
  }
  if (data.category === 'parent_child' && !data.childRelation) {
    throw new ValidationError('childRelation is required for parent_child relationships');
  }

  // Verify both persons exist in this tree
  const personsCheck = await query(
    'SELECT id FROM persons WHERE tree_id = $1 AND id IN ($2, $3)',
    [treeId, data.person1Id, data.person2Id]
  );
  if (personsCheck.rows.length < 2) {
    throw new ValidationError('One or both persons not found in this tree');
  }

  const result = await query(
    `INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status, child_relation, start_date, end_date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      treeId,
      data.category,
      data.person1Id,
      data.person2Id,
      data.category === 'couple' ? data.coupleStatus : null,
      data.category === 'parent_child' ? data.childRelation : null,
      data.startDate || null,
      data.endDate || null,
      data.note || null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function updateRelationship(treeId: string, relId: string, data: {
  coupleStatus?: string;
  childRelation?: string;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
}) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.coupleStatus !== undefined) { sets.push(`couple_status = $${idx++}`); params.push(data.coupleStatus); }
  if (data.childRelation !== undefined) { sets.push(`child_relation = $${idx++}`); params.push(data.childRelation); }
  if (data.startDate !== undefined) { sets.push(`start_date = $${idx++}`); params.push(data.startDate); }
  if (data.endDate !== undefined) { sets.push(`end_date = $${idx++}`); params.push(data.endDate); }
  if (data.note !== undefined) { sets.push(`note = $${idx++}`); params.push(data.note); }

  if (sets.length === 0) throw new ValidationError('Nothing to update');

  sets.push('updated_at = NOW()');
  params.push(relId, treeId);

  const result = await query(
    `UPDATE relationships SET ${sets.join(', ')}
     WHERE id = $${idx} AND tree_id = $${idx + 1}
     RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Relationship');
  return mapRow(result.rows[0]);
}

export async function deleteRelationship(treeId: string, relId: string) {
  const result = await query(
    'DELETE FROM relationships WHERE id = $1 AND tree_id = $2 RETURNING id',
    [relId, treeId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Relationship');
  return { deleted: true };
}
