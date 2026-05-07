import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

export interface Tree { id: string; userId: string; name: string; description: string | null; ownerPersonId: string | null; visibility: string; shareToken: string | null; }

const ROW_TO_TREE = `id, user_id AS "userId", name, description, owner_person_id AS "ownerPersonId", visibility, share_token AS "shareToken"`;

export const listTrees = async (userId: string): Promise<(Tree & { personCount: number })[]> => {
  const r = await query<any>(`
    SELECT ${ROW_TO_TREE}, (SELECT COUNT(*)::int FROM persons p WHERE p.tree_id = t.id) AS "personCount"
    FROM trees t WHERE user_id = $1 ORDER BY created_at DESC
  `, [userId]);
  return r.rows;
};

export const createTree = async (userId: string, name: string, description?: string): Promise<Tree> => {
  const r = await query<any>(`INSERT INTO trees (user_id, name, description) VALUES ($1, $2, $3) RETURNING ${ROW_TO_TREE}`,
    [userId, name, description ?? null]);
  return r.rows[0];
};

export const getTree = async (id: string): Promise<Tree> => {
  const r = await query<any>(`SELECT ${ROW_TO_TREE} FROM trees WHERE id = $1`, [id]);
  if (r.rowCount === 0) throw new NotFoundError('Tree not found');
  return r.rows[0];
};

export const updateTree = async (id: string, fields: Partial<Pick<Tree, 'name' | 'description' | 'ownerPersonId' | 'visibility'>>): Promise<Tree> => {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    const col = ({ ownerPersonId: 'owner_person_id' } as Record<string,string>)[k] ?? k;
    sets.push(`${col} = $${i++}`); params.push(v);
  }
  if (sets.length === 0) return getTree(id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const r = await query<any>(`UPDATE trees SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${ROW_TO_TREE}`, params);
  return r.rows[0];
};

export const deleteTree = async (id: string): Promise<void> => {
  await query(`DELETE FROM trees WHERE id = $1`, [id]);
};

// BFS generations from owner (gen=0): parents = -1, children = +1, spouses = same
export const getFullTree = async (treeId: string) => {
  const tree = await getTree(treeId);
  const persons = (await query(`SELECT * FROM persons WHERE tree_id = $1 ORDER BY birth_year NULLS LAST, birth_date NULLS LAST`, [treeId])).rows;
  const rels = (await query(`SELECT * FROM relationships WHERE tree_id = $1`, [treeId])).rows;

  const generations: { number: number; label: string; personIds: string[] }[] = [];
  if (tree.ownerPersonId && persons.length) {
    const gen = new Map<string, number>();
    gen.set(tree.ownerPersonId, 0);
    const queue = [tree.ownerPersonId];
    while (queue.length) {
      const cur = queue.shift()!;
      const g = gen.get(cur)!;
      for (const r of rels as any[]) {
        let other: string | null = null, dg = 0;
        if (r.category === 'parent_child') {
          if (r.person1_id === cur) { other = r.person2_id; dg = 1; }
          else if (r.person2_id === cur) { other = r.person1_id; dg = -1; }
        } else if (r.category === 'couple') {
          if (r.person1_id === cur) other = r.person2_id;
          else if (r.person2_id === cur) other = r.person1_id;
        }
        if (other && !gen.has(other)) { gen.set(other, g + dg); queue.push(other); }
      }
    }
    for (const p of persons as any[]) if (!gen.has(p.id)) gen.set(p.id, 0);
    const labels: Record<number, string> = { '-4': 'Прапрадеды', '-3': 'Прадеды', '-2': 'Деды и Бабушки', '-1': 'Родители', '0': 'Я и сиблинги', '1': 'Дети', '2': 'Внуки', '3': 'Правнуки' };
    const buckets = new Map<number, string[]>();
    for (const [pid, g] of gen) buckets.set(g, [...(buckets.get(g) ?? []), pid]);
    for (const [g, ids] of [...buckets].sort((a, b) => a[0] - b[0])) {
      generations.push({ number: g, label: labels[g] ?? `Поколение ${g}`, personIds: ids });
    }
  }

  return { tree, persons, relationships: rels, generations };
};
