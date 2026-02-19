import type { Person, Relationship, Generation as GenType } from '../../types';
import PersonCard from './PersonCard';
import CoupleWrapper from './CoupleWrapper';

interface GenerationProps {
  generation: GenType;
  persons: Person[];
  relationships: Relationship[];
  ownerPersonId: string | null;
  genIndex: number;
  totalGens: number;
  nextGenPersonIds?: string[];
  onCardClick?: (person: Person) => void;
  onAddClick?: (person: Person) => void;
  onEditClick?: (person: Person) => void;
  onDeleteClick?: (person: Person) => void;
}

/**
 * Build renderable items for a generation.
 *
 * Rule: siblings (children of same parents) are grouped together and sorted
 * by age left-to-right. If a sibling has a partner (couple), the partner is
 * placed next to them (as CoupleWrapper), NOT at the partner's own age position.
 * Spouses who "married into" the family appear only via their partner's CoupleWrapper.
 *
 * Algorithm:
 * 1. Identify "siblings" = persons who are children of parents in previous gen.
 * 2. Group siblings by their parent-set (sorted parent IDs joined).
 * 3. Iterate sibling groups in the order of the first sibling encountered.
 *    Within each group, iterate siblings in age order, attaching couple partners.
 * 4. Spouse-only persons (no parents in tree) are placed next to their partner.
 */
function buildGenItems(
  personIds: string[],
  persons: Person[],
  relationships: Relationship[]
): Array<
  | { type: 'couple'; person1: Person; person2: Person; relationship: Relationship }
  | { type: 'single'; person: Person }
> {
  const personMap = new Map(persons.map(p => [p.id, p]));
  const placed = new Set<string>();
  const items: Array<
    | { type: 'couple'; person1: Person; person2: Person; relationship: Relationship }
    | { type: 'single'; person: Person }
  > = [];

  // Build lookup: personId -> ALL couple relationships within this generation
  const personIdSet = new Set(personIds);
  const coupleRels = relationships.filter(
    r => r.category === 'couple' &&
      personIdSet.has(r.person1Id) &&
      personIdSet.has(r.person2Id)
  );
  const couplesByPerson = new Map<string, Array<{ partner: string; rel: Relationship }>>();
  for (const rel of coupleRels) {
    if (!couplesByPerson.has(rel.person1Id)) couplesByPerson.set(rel.person1Id, []);
    if (!couplesByPerson.has(rel.person2Id)) couplesByPerson.set(rel.person2Id, []);
    couplesByPerson.get(rel.person1Id)!.push({ partner: rel.person2Id, rel });
    couplesByPerson.get(rel.person2Id)!.push({ partner: rel.person1Id, rel });
  }

  // Build parent-set for each person in this generation
  // parentKey = sorted parent IDs joined by '+'
  const parentKeyOf = new Map<string, string>();
  const parentChildRels = relationships.filter(
    r => r.category === 'parent_child' && personIdSet.has(r.person2Id)
  );
  const personParents = new Map<string, string[]>();
  for (const rel of parentChildRels) {
    if (!personParents.has(rel.person2Id)) personParents.set(rel.person2Id, []);
    personParents.get(rel.person2Id)!.push(rel.person1Id);
  }
  for (const [pid, parents] of personParents) {
    parentKeyOf.set(pid, [...parents].sort().join('+'));
  }

  // Identify siblings (have parents) vs spouse-only
  const siblings = personIds.filter(id => parentKeyOf.has(id));

  // Group siblings by their parent-set, preserving encounter order from personIds
  const siblingGroups = new Map<string, string[]>();
  const groupOrder: string[] = [];
  for (const sid of siblings) {
    const key = parentKeyOf.get(sid)!;
    if (!siblingGroups.has(key)) {
      siblingGroups.set(key, []);
      groupOrder.push(key);
    }
    siblingGroups.get(key)!.push(sid);
  }

  // Helper: place a person (with optional couple partner)
  function placePerson(pid: string) {
    if (placed.has(pid)) return;
    const person = personMap.get(pid);
    if (!person) return;

    const couples = (couplesByPerson.get(pid) || []).filter(c => !placed.has(c.partner));
    if (couples.length > 0) {
      const active = couples.find(c =>
        c.rel.coupleStatus !== 'divorced' && c.rel.coupleStatus !== 'widowed'
      );
      const primary = active || couples[0];
      const partner = personMap.get(primary.partner);

      if (partner) {
        items.push({ type: 'couple', person1: person, person2: partner, relationship: primary.rel });
        placed.add(pid);
        placed.add(primary.partner);

        // Remaining partners as singles next to them
        for (const c of couples) {
          if (c.partner === primary.partner) continue;
          if (placed.has(c.partner)) continue;
          const otherPartner = personMap.get(c.partner);
          if (otherPartner) {
            items.push({ type: 'single', person: otherPartner });
            placed.add(c.partner);
          }
        }
        return;
      }
    }

    items.push({ type: 'single', person });
    placed.add(pid);
  }

  if (siblingGroups.size > 0) {
    // Iterate sibling groups in order, placing all siblings from same parents together.
    // Within each group: place single siblings first, then siblings with a spouse-partner
    // (partner from a different parent-group). This keeps blood siblings clustered on one side.
    for (const key of groupOrder) {
      const group = siblingGroups.get(key)!;
      const groupSet = new Set(group);

      // Separate: siblings whose couple partner is NOT in this sibling group (has outside spouse)
      const withOutsideSpouse: string[] = [];
      const withoutOutsideSpouse: string[] = [];

      for (const sid of group) {
        const couples = couplesByPerson.get(sid) || [];
        const hasOutsidePartner = couples.some(c => !groupSet.has(c.partner));
        if (hasOutsidePartner) {
          withOutsideSpouse.push(sid);
        } else {
          withoutOutsideSpouse.push(sid);
        }
      }

      // Place singles first, then those with outside spouse (couple wrapper goes to the right)
      for (const sid of withoutOutsideSpouse) {
        placePerson(sid);
      }
      for (const sid of withOutsideSpouse) {
        placePerson(sid);
      }
    }
  } else {
    // No siblings detected — use personIds order as-is
    for (const pid of personIds) {
      placePerson(pid);
    }
  }

  // Place any remaining spouse-only persons that weren't paired
  for (const pid of personIds) {
    if (placed.has(pid)) continue;
    const person = personMap.get(pid);
    if (!person) continue;
    items.push({ type: 'single', person });
    placed.add(pid);
  }

  return items;
}

/**
 * Sort person IDs so that parent COUPLES appear above their children in the next generation.
 * This prevents connector lines from crossing.
 *
 * Only reorders couples that have children in the next gen AND whose children
 * are in a different position than their current order. Siblings (non-couple
 * persons with shared parents) keep their age-based order.
 */
function sortByChildPosition(
  personIds: string[],
  persons: Person[],
  relationships: Relationship[],
  nextGenPersonIds?: string[]
): string[] {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Age-based sort as default
  const ageSorted = [...personIds].sort((a, b) => {
    const pa = personMap.get(a);
    const pb = personMap.get(b);
    const yearA = pa?.birthDate ? new Date(pa.birthDate).getFullYear() : (pa?.birthYear ?? 9999);
    const yearB = pb?.birthDate ? new Date(pb.birthDate).getFullYear() : (pb?.birthYear ?? 9999);
    return yearA - yearB;
  });

  if (!nextGenPersonIds || nextGenPersonIds.length === 0) return ageSorted;

  const thisGenSet = new Set(personIds);

  // Find couples in this generation
  const coupleRels = relationships.filter(
    r => r.category === 'couple' && thisGenSet.has(r.person1Id) && thisGenSet.has(r.person2Id)
  );

  // If no couples, no reordering needed
  if (coupleRels.length <= 1) return ageSorted;

  // Compute the VISUAL order of next gen by running buildGenItems on it.
  // This ensures we sort parents by where their children actually appear on screen.
  const nextGenItems = buildGenItems(nextGenPersonIds, persons, relationships);
  const visualNextGenOrder: string[] = [];
  for (const item of nextGenItems) {
    if (item.type === 'couple') {
      visualNextGenOrder.push(item.person1.id, item.person2.id);
    } else {
      visualNextGenOrder.push(item.person.id);
    }
  }

  // Build map: parentId -> list of child visual indices
  const parentChildRels = relationships.filter(r => r.category === 'parent_child');
  const nextGenSet = new Set(nextGenPersonIds);

  const parentToChildIndices = new Map<string, number[]>();
  for (const rel of parentChildRels) {
    if (thisGenSet.has(rel.person1Id) && nextGenSet.has(rel.person2Id)) {
      const childIdx = visualNextGenOrder.indexOf(rel.person2Id);
      if (childIdx >= 0) {
        if (!parentToChildIndices.has(rel.person1Id)) parentToChildIndices.set(rel.person1Id, []);
        const arr = parentToChildIndices.get(rel.person1Id)!;
        if (!arr.includes(childIdx)) arr.push(childIdx);
      }
    }
  }

  // Merge child indices between couple partners (they share children)
  for (const rel of coupleRels) {
    const arr1 = parentToChildIndices.get(rel.person1Id) || [];
    const arr2 = parentToChildIndices.get(rel.person2Id) || [];
    const merged = [...new Set([...arr1, ...arr2])];
    if (merged.length > 0) {
      parentToChildIndices.set(rel.person1Id, merged);
      parentToChildIndices.set(rel.person2Id, merged);
    }
  }

  // Compute average child index for sorting (center of mass of children)
  const parentToAvgChildIdx = new Map<string, number>();
  for (const [pid, indices] of parentToChildIndices) {
    if (indices.length > 0) {
      parentToAvgChildIdx.set(pid, indices.reduce((a, b) => a + b, 0) / indices.length);
    }
  }

  // Identify which persons are part of a "parent couple" — at least one partner
  // has children in the next generation. Only reorder these.
  const inParentCouple = new Set<string>();
  for (const rel of coupleRels) {
    const has1 = parentToAvgChildIdx.has(rel.person1Id);
    const has2 = parentToAvgChildIdx.has(rel.person2Id);
    if (has1 || has2) {
      inParentCouple.add(rel.person1Id);
      inParentCouple.add(rel.person2Id);
    }
  }

  // Sort only parent-couple persons by average child position,
  // keep all others in their age-sorted position.
  const couplePersons = ageSorted.filter(id => inParentCouple.has(id));
  const sortedCouplePersons = [...couplePersons].sort((a, b) => {
    const idxA = parentToAvgChildIdx.get(a) ?? 999;
    const idxB = parentToAvgChildIdx.get(b) ?? 999;
    return idxA - idxB;
  });

  // Rebuild: replace parent-couple persons in their original slots with sorted order
  let coupleIdx = 0;
  return ageSorted.map(id => {
    if (inParentCouple.has(id)) {
      return sortedCouplePersons[coupleIdx++];
    }
    return id;
  });
}

export default function Generation({
  generation,
  persons,
  relationships,
  ownerPersonId,
  genIndex,
  totalGens,
  nextGenPersonIds,
  onCardClick,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: GenerationProps) {
  const sortedPersonIds = sortByChildPosition(
    generation.personIds, persons, relationships, nextGenPersonIds
  );

  const items = buildGenItems(sortedPersonIds, persons, relationships);

  // Determine gen class for CSS (gen-3 = children/last gen has smaller gap)
  const isLastGen = genIndex === totalGens - 1 && totalGens > 1;
  const genClass = `generation${isLastGen ? ' gen-3' : ''}`;

  let cardIndex = 0;

  return (
    <>
      <div className="gen-label">
        <span>{generation.label}</span>
      </div>
      <div className={genClass}>
        {items.map((item) => {
          if (item.type === 'couple') {
            const baseDelay = cardIndex * 0.08;
            cardIndex += 2;
            return (
              <CoupleWrapper
                key={`${item.person1.id}-${item.person2.id}`}
                person1={item.person1}
                person2={item.person2}
                relationship={item.relationship}
                ownerPersonId={ownerPersonId}
                animationBaseDelay={baseDelay}
                onCardClick={onCardClick}
                onAddClick={onAddClick}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
              />
            );
          } else {
            const delay = cardIndex * 0.08;
            cardIndex++;
            return (
              <PersonCard
                key={item.person.id}
                person={item.person}
                isOwner={item.person.id === ownerPersonId}
                animationDelay={delay}
                onCardClick={onCardClick}
                onAddClick={onAddClick}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
              />
            );
          }
        })}
      </div>
      {/* Connector space between generations (except after last) */}
      {genIndex < totalGens - 1 && <div className="connector-space" />}
    </>
  );
}
