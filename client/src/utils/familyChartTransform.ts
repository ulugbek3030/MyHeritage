/**
 * Transform our DB data (Person[] + Relationship[]) into the format
 * required by the `family-chart` library.
 *
 * family-chart expects: { id, data: { gender: 'M'|'F', ... }, rels: { spouses, children, parents } }
 *
 * Key logic:
 *   - Map explicit `couple` relationships → spouses
 *   - Detect implicit co-parents (share children but no couple rel) → add as spouses
 *   - All relationships are bidirectional
 */
import type { Person, Relationship } from '../types';
import type { Datum } from 'family-chart';

/**
 * Convert Person[] + Relationship[] → family-chart Data (Datum[])
 */
export function transformToFamilyChartData(
  persons: Person[],
  relationships: Relationship[],
): Datum[] {
  const personIds = new Set(persons.map(p => p.id));

  // Build relationship maps
  const childrenOf = new Map<string, Set<string>>(); // parentId → set of childIds
  const parentsOf = new Map<string, Set<string>>();   // childId → set of parentIds
  const spousesOf = new Map<string, Set<string>>();   // personId → set of spouseIds

  for (const rel of relationships) {
    if (rel.category === 'parent_child') {
      const parentId = rel.person1Id;
      const childId = rel.person2Id;
      if (!personIds.has(parentId) || !personIds.has(childId)) continue;

      if (!childrenOf.has(parentId)) childrenOf.set(parentId, new Set());
      childrenOf.get(parentId)!.add(childId);

      if (!parentsOf.has(childId)) parentsOf.set(childId, new Set());
      parentsOf.get(childId)!.add(parentId);
    }

    if (rel.category === 'couple') {
      const id1 = rel.person1Id;
      const id2 = rel.person2Id;
      if (!personIds.has(id1) || !personIds.has(id2)) continue;

      if (!spousesOf.has(id1)) spousesOf.set(id1, new Set());
      spousesOf.get(id1)!.add(id2);

      if (!spousesOf.has(id2)) spousesOf.set(id2, new Set());
      spousesOf.get(id2)!.add(id1);
    }
  }

  // Detect implicit co-parents: if two persons share a child but have no couple rel
  for (const [, parentIds] of parentsOf) {
    const parents = Array.from(parentIds);
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const a = parents[i];
        const b = parents[j];

        // Check if already spouses
        if (spousesOf.has(a) && spousesOf.get(a)!.has(b)) continue;

        // Add as implicit spouses
        if (!spousesOf.has(a)) spousesOf.set(a, new Set());
        spousesOf.get(a)!.add(b);

        if (!spousesOf.has(b)) spousesOf.set(b, new Set());
        spousesOf.get(b)!.add(a);
      }
    }
  }

  // Build family-chart nodes
  return persons.map((person): Datum => ({
    id: person.id,
    data: {
      gender: person.gender === 'male' ? 'M' : 'F',
      'first name': person.firstName,
      'last name': person.lastName || '',
      // Store full Person reference for custom card rendering
      _person: person,
    },
    rels: {
      spouses: Array.from(spousesOf.get(person.id) || []),
      children: Array.from(childrenOf.get(person.id) || []),
      parents: Array.from(parentsOf.get(person.id) || []),
    },
  }));
}
