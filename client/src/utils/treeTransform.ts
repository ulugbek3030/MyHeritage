/**
 * Transform our DB data (Person[] + Relationship[]) into the Node[] format
 * required by the `relatives-tree` layout engine.
 *
 * Key rule: ALL relationships must be BIDIRECTIONAL.
 * If A is parent of B → A.children includes B AND B.parents includes A.
 * If A is married to B → A.spouses includes B AND B.spouses includes A.
 */
import type { Person, Relationship } from '../types';

// relatives-tree uses these exact string types
export interface TreeNode {
  id: string;
  gender: 'male' | 'female';
  parents: ReadonlyArray<{ id: string; type: 'blood' | 'adopted' | 'half' }>;
  children: ReadonlyArray<{ id: string; type: 'blood' | 'adopted' | 'half' }>;
  siblings: ReadonlyArray<{ id: string; type: 'blood' | 'half' }>;
  spouses: ReadonlyArray<{ id: string; type: 'married' | 'divorced' }>;
}

/**
 * Map our childRelation to relatives-tree RelType
 */
function mapChildRelType(rel: Relationship): 'blood' | 'adopted' | 'half' {
  if (rel.childRelation === 'adopted' || rel.childRelation === 'foster' || rel.childRelation === 'guardianship') {
    return 'adopted';
  }
  if (rel.childRelation === 'stepchild') {
    return 'half';
  }
  return 'blood';
}

/**
 * Map our coupleStatus to relatives-tree RelType
 */
function mapCoupleType(rel: Relationship): 'married' | 'divorced' {
  if (rel.coupleStatus === 'divorced') return 'divorced';
  return 'married';
}

export function transformToTreeNodes(
  persons: Person[],
  relationships: Relationship[]
): TreeNode[] {
  const personIds = new Set(persons.map(p => p.id));

  // Build relationship maps
  const parentOf = new Map<string, Array<{ childId: string; type: 'blood' | 'adopted' | 'half' }>>();
  const childOf = new Map<string, Array<{ parentId: string; type: 'blood' | 'adopted' | 'half' }>>();
  const spouseOf = new Map<string, Array<{ spouseId: string; type: 'married' | 'divorced' }>>();

  for (const rel of relationships) {
    if (rel.category === 'parent_child') {
      const parentId = rel.person1Id;
      const childId = rel.person2Id;
      if (!personIds.has(parentId) || !personIds.has(childId)) continue;

      const relType = mapChildRelType(rel);

      if (!parentOf.has(parentId)) parentOf.set(parentId, []);
      parentOf.get(parentId)!.push({ childId, type: relType });

      if (!childOf.has(childId)) childOf.set(childId, []);
      childOf.get(childId)!.push({ parentId, type: relType });
    }

    if (rel.category === 'couple') {
      const id1 = rel.person1Id;
      const id2 = rel.person2Id;
      if (!personIds.has(id1) || !personIds.has(id2)) continue;

      const coupleType = mapCoupleType(rel);

      if (!spouseOf.has(id1)) spouseOf.set(id1, []);
      spouseOf.get(id1)!.push({ spouseId: id2, type: coupleType });

      if (!spouseOf.has(id2)) spouseOf.set(id2, []);
      spouseOf.get(id2)!.push({ spouseId: id1, type: coupleType });
    }
  }

  // Build sibling map: persons who share the same parents are siblings
  // Group children by sorted parent IDs
  const parentKeyToChildren = new Map<string, string[]>();
  for (const [childId, parents] of childOf) {
    const key = parents.map(p => p.parentId).sort().join('+');
    if (!parentKeyToChildren.has(key)) parentKeyToChildren.set(key, []);
    parentKeyToChildren.get(key)!.push(childId);
  }

  const siblingOf = new Map<string, Array<{ siblingId: string; type: 'blood' | 'half' }>>();
  for (const [, children] of parentKeyToChildren) {
    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const a = children[i];
        const b = children[j];

        if (!siblingOf.has(a)) siblingOf.set(a, []);
        if (!siblingOf.has(b)) siblingOf.set(b, []);

        // Don't add duplicates
        if (!siblingOf.get(a)!.some(s => s.siblingId === b)) {
          siblingOf.get(a)!.push({ siblingId: b, type: 'blood' });
        }
        if (!siblingOf.get(b)!.some(s => s.siblingId === a)) {
          siblingOf.get(b)!.push({ siblingId: a, type: 'blood' });
        }
      }
    }
  }

  return persons.map(person => ({
    id: person.id,
    gender: person.gender as 'male' | 'female',
    parents: (childOf.get(person.id) || []).map(p => ({
      id: p.parentId,
      type: p.type,
    })),
    children: (parentOf.get(person.id) || []).map(c => ({
      id: c.childId,
      type: c.type,
    })),
    siblings: (siblingOf.get(person.id) || []).map(s => ({
      id: s.siblingId,
      type: s.type,
    })),
    spouses: (spouseOf.get(person.id) || []).map(s => ({
      id: s.spouseId,
      type: s.type,
    })),
  }));
}
