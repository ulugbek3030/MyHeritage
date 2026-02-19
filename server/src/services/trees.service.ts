import { query, getClient } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

export async function listTrees(userId: string) {
  const result = await query(
    `SELECT t.id, t.name, t.description, t.owner_person_id, t.created_at, t.updated_at,
            (SELECT COUNT(*) FROM persons WHERE tree_id = t.id)::int AS person_count
     FROM trees t
     WHERE t.user_id = $1
     ORDER BY t.updated_at DESC`,
    [userId]
  );
  return result.rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    ownerPersonId: r.owner_person_id,
    personCount: r.person_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createTree(userId: string, name: string, description?: string) {
  const result = await query(
    `INSERT INTO trees (user_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, owner_person_id, created_at, updated_at`,
    [userId, name, description || null]
  );
  const r = result.rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    ownerPersonId: r.owner_person_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getTree(treeId: string) {
  const result = await query(
    `SELECT id, user_id, name, description, owner_person_id, created_at, updated_at
     FROM trees WHERE id = $1`,
    [treeId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Tree');
  const r = result.rows[0];
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    ownerPersonId: r.owner_person_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function updateTree(treeId: string, data: { name?: string; description?: string; ownerPersonId?: string | null }) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.ownerPersonId !== undefined) { sets.push(`owner_person_id = $${idx++}`); params.push(data.ownerPersonId); }

  if (sets.length === 0) return getTree(treeId);

  sets.push(`updated_at = NOW()`);
  params.push(treeId);

  const result = await query(
    `UPDATE trees SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, name, description, owner_person_id, created_at, updated_at`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Tree');
  const r = result.rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    ownerPersonId: r.owner_person_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function deleteTree(treeId: string) {
  const result = await query('DELETE FROM trees WHERE id = $1 RETURNING id', [treeId]);
  if (result.rows.length === 0) throw new NotFoundError('Tree');
  return { deleted: true };
}

// ═══════════ FULL TREE (the big one) ═══════════

export async function getFullTree(treeId: string) {
  // 1. Tree metadata
  const treeRes = await query(
    'SELECT id, name, description, owner_person_id FROM trees WHERE id = $1',
    [treeId]
  );
  if (treeRes.rows.length === 0) throw new NotFoundError('Tree');
  const tree = treeRes.rows[0];

  // 2. All persons
  const personsRes = await query(
    `SELECT id, first_name, last_name, middle_name, maiden_name, gender,
            birth_date, birth_year, birth_date_known,
            is_alive, death_date, death_year, death_date_known,
            photo_url, note
     FROM persons WHERE tree_id = $1
     ORDER BY created_at`,
    [treeId]
  );

  const persons = personsRes.rows.map(r => ({
    id: r.id,
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
  }));

  // 3. All relationships
  const relsRes = await query(
    `SELECT id, category, person1_id, person2_id, couple_status, child_relation,
            start_date, end_date, note
     FROM relationships WHERE tree_id = $1
     ORDER BY created_at`,
    [treeId]
  );

  const relationships = relsRes.rows.map(r => ({
    id: r.id,
    category: r.category,
    person1Id: r.person1_id,
    person2Id: r.person2_id,
    coupleStatus: r.couple_status,
    childRelation: r.child_relation,
    startDate: r.start_date,
    endDate: r.end_date,
    note: r.note,
  }));

  // 4. Compute generations via BFS from owner
  const generations = computeGenerations(
    tree.owner_person_id,
    persons,
    relationships
  );

  return {
    tree: {
      id: tree.id,
      name: tree.name,
      description: tree.description,
      ownerPersonId: tree.owner_person_id,
    },
    persons,
    relationships,
    generations,
  };
}

// ═══════════ GENERATION COMPUTATION (BFS) ═══════════

interface MinPerson { id: string; gender: string; }
interface MinRel { category: string; person1Id: string; person2Id: string; }

function computeGenerations(
  ownerPersonId: string | null,
  persons: MinPerson[],
  relationships: MinRel[]
) {
  if (!ownerPersonId || persons.length === 0) {
    // No owner — put everyone in generation 1
    return [{
      number: 1,
      label: 'Все',
      personIds: persons.map(p => p.id),
    }];
  }

  // Build adjacency maps
  const parentOf = new Map<string, string[]>(); // child -> parents[]
  const childOf = new Map<string, string[]>();  // parent -> children[]
  const coupleOf = new Map<string, string[]>(); // person -> partners[]

  for (const rel of relationships) {
    if (rel.category === 'parent_child') {
      // person1 = parent, person2 = child
      if (!parentOf.has(rel.person2Id)) parentOf.set(rel.person2Id, []);
      parentOf.get(rel.person2Id)!.push(rel.person1Id);
      if (!childOf.has(rel.person1Id)) childOf.set(rel.person1Id, []);
      childOf.get(rel.person1Id)!.push(rel.person2Id);
    } else if (rel.category === 'couple') {
      if (!coupleOf.has(rel.person1Id)) coupleOf.set(rel.person1Id, []);
      coupleOf.get(rel.person1Id)!.push(rel.person2Id);
      if (!coupleOf.has(rel.person2Id)) coupleOf.set(rel.person2Id, []);
      coupleOf.get(rel.person2Id)!.push(rel.person1Id);
    }
  }

  // BFS from owner
  const genMap = new Map<string, number>(); // personId -> generation number
  genMap.set(ownerPersonId, 0);
  const queue: string[] = [ownerPersonId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentGen = genMap.get(current)!;

    // Parents → generation - 1
    const parents = parentOf.get(current) || [];
    for (const pid of parents) {
      if (!genMap.has(pid)) {
        genMap.set(pid, currentGen - 1);
        queue.push(pid);
      }
    }

    // Children → generation + 1
    const children = childOf.get(current) || [];
    for (const cid of children) {
      if (!genMap.has(cid)) {
        genMap.set(cid, currentGen + 1);
        queue.push(cid);
      }
    }

    // Partners → same generation
    const partners = coupleOf.get(current) || [];
    for (const pid of partners) {
      if (!genMap.has(pid)) {
        genMap.set(pid, currentGen);
        queue.push(pid);
      }
    }
  }

  // Assign unconnected persons to owner's generation
  for (const p of persons) {
    if (!genMap.has(p.id)) {
      genMap.set(p.id, 0);
    }
  }

  // Group by generation
  const groups = new Map<number, string[]>();
  for (const [pid, gen] of genMap) {
    if (!groups.has(gen)) groups.set(gen, []);
    groups.get(gen)!.push(pid);
  }

  // Sort by generation number and build result
  const ownerGen = 0;
  const sortedGens = Array.from(groups.keys()).sort((a, b) => a - b);

  return sortedGens.map((gen, idx) => ({
    number: idx + 1,
    label: getGenerationLabel(gen - ownerGen),
    personIds: groups.get(gen)!,
  }));
}

function getGenerationLabel(relativeGen: number): string {
  switch (relativeGen) {
    case -4: return 'Прапрадедушки и Прапрабабушки';
    case -3: return 'Прадедушки и Прабабушки';
    case -2: return 'Дедушки и Бабушки';
    case -1: return 'Родители';
    case 0: return 'Вы, Братья и Сёстры';
    case 1: return 'Дети';
    case 2: return 'Внуки';
    case 3: return 'Правнуки';
    default:
      if (relativeGen < -4) return `Предки (${Math.abs(relativeGen)} поколение)`;
      return `Потомки (${relativeGen} поколение)`;
  }
}
