import type { Relationship } from '../types';

export const reachableFromRoot = (
  rootId: string,
  rels: Relationship[],
  maxHops = 3
): Set<string> => {
  const reach = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const r of rels) {
        const other = r.person1Id === id ? r.person2Id : r.person2Id === id ? r.person1Id : null;
        if (other && !reach.has(other)) { reach.add(other); next.push(other); }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return reach;
};

export const computeRelation = (rootId: string, viewerId: string, _rels: Relationship[]): string | null => {
  // MVP placeholder. Full computeRelation deferred to Phase 1.5.
  return rootId === viewerId ? null : 'родственник';
};
