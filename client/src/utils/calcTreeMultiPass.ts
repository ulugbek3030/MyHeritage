/**
 * Multi-pass wrapper around `relatives-tree` calcTree.
 *
 * Problem: relatives-tree only traverses parents/children/spouses from rootId.
 * It does NOT follow siblings or discover other children of ancestors (uncles/aunts).
 *
 * Solution:
 *   1. Primary pass with ownerPersonId as root → covers most nodes (e.g. 12/13)
 *   2. Find missing nodes (uncles/aunts)
 *   3. For each missing person, find their parents in primary result (shared anchors)
 *   4. Place the missing person next to their sibling (who IS in primary)
 *   5. Generate only the needed connectors (parent→child drop lines)
 *
 * This preserves ALL primary connectors untouched (they're perfect from relatives-tree).
 */
import calcTree from 'relatives-tree';
import type { Node as RTNode, ExtNode, Connector } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../types';
import { transformToTreeNodes } from './treeTransform';

interface MultiPassResult {
  canvas: { width: number; height: number };
  nodes: ExtNode[];
  connectors: Connector[];
}

export function calcTreeMultiPass(
  persons: Person[],
  relationships: Relationship[],
  ownerPersonId: string
): MultiPassResult {
  const treeNodes = transformToTreeNodes(persons, relationships) as unknown as RTNode[];
  const allIds = new Set(persons.map(p => p.id));
  const personMap = new Map(persons.map(p => [p.id, p]));

  // ── Build relationship maps ──
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.category === 'parent_child') {
      const parentId = rel.person1Id;
      const childId = rel.person2Id;
      if (!parentsOf.has(childId)) parentsOf.set(childId, []);
      parentsOf.get(childId)!.push(parentId);
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId)!.push(childId);
    }
    if (rel.category === 'couple') {
      if (!spousesOf.has(rel.person1Id)) spousesOf.set(rel.person1Id, []);
      spousesOf.get(rel.person1Id)!.push(rel.person2Id);
      if (!spousesOf.has(rel.person2Id)) spousesOf.set(rel.person2Id, []);
      spousesOf.get(rel.person2Id)!.push(rel.person1Id);
    }
  }

  // ── Pass 1: Primary run with owner as root ──
  const primary = calcTree(treeNodes, { rootId: ownerPersonId });
  const placedIds = new Set(primary.nodes.map(n => n.id));
  const missingIds = [...allIds].filter(id => !placedIds.has(id));

  // If all nodes covered, just return primary
  if (missingIds.length === 0) {
    return {
      canvas: { width: primary.canvas.width, height: primary.canvas.height },
      nodes: [...primary.nodes],
      connectors: [...primary.connectors],
    };
  }

  // ── Build position map from primary ──
  const posMap = new Map<string, { left: number; top: number }>();
  for (const n of primary.nodes) {
    posMap.set(n.id, { left: n.left, top: n.top });
  }

  const allNodes: ExtNode[] = [...primary.nodes];
  const allConnectors: Connector[] = [...primary.connectors];

  // ── Place missing nodes next to their siblings ──
  for (const missingId of missingIds) {
    const parents = parentsOf.get(missingId) || [];

    // Find siblings already placed (share at least one parent)
    const placedSiblings: string[] = [];
    for (const parentId of parents) {
      for (const childId of (childrenOf.get(parentId) || [])) {
        if (childId !== missingId && posMap.has(childId) && !placedSiblings.includes(childId)) {
          placedSiblings.push(childId);
        }
      }
    }

    if (placedSiblings.length === 0 && parents.length === 0) {
      // No connection to primary tree — place at right edge
      let maxLeft = 0;
      for (const pos of posMap.values()) maxLeft = Math.max(maxLeft, pos.left);
      const newLeft = maxLeft + 4;
      const newTop = 0;
      posMap.set(missingId, { left: newLeft, top: newTop });

      const person = personMap.get(missingId);
      allNodes.push({
        id: missingId,
        left: newLeft,
        top: newTop,
        gender: (person?.gender || 'male') as any,
        parents: [],
        children: [],
        siblings: [],
        spouses: [],
        hasSubTree: false,
      });
      continue;
    }

    // Determine the row (top) — same as siblings
    let targetTop: number | null = null;
    if (placedSiblings.length > 0) {
      targetTop = posMap.get(placedSiblings[0])!.top;
    } else if (parents.some(pid => posMap.has(pid))) {
      // No placed siblings, but parents are placed — place one row below parents
      const parentPos = parents.filter(pid => posMap.has(pid)).map(pid => posMap.get(pid)!);
      targetTop = parentPos[0].top + 2; // standard generation gap in relatives-tree
    }

    if (targetTop === null) continue;

    // Find position: to the LEFT of the leftmost sibling on this row
    // (uncle goes to the left of father in the parents' generation)
    const rowNodes = allNodes.filter(n => n.top === targetTop);
    const siblingsOnRow = placedSiblings.filter(id => posMap.get(id)?.top === targetTop);

    let targetLeft: number;

    if (siblingsOnRow.length > 0) {
      // Place to the left of leftmost sibling
      const siblingLefts = siblingsOnRow.map(id => posMap.get(id)!.left);
      const minSibLeft = Math.min(...siblingLefts);

      // Check if there's room to the left (2 grid units minimum gap)
      const leftNeighbor = rowNodes
        .filter(n => n.left < minSibLeft)
        .sort((a, b) => b.left - a.left)[0];

      if (leftNeighbor && minSibLeft - leftNeighbor.left < 4) {
        // Not enough room — place to the right of rightmost node on row
        const maxRowLeft = Math.max(...rowNodes.map(n => n.left));
        targetLeft = maxRowLeft + 2;
      } else {
        targetLeft = minSibLeft - 2;
      }
    } else {
      // No siblings on this row, place at end
      const maxRowLeft = rowNodes.length > 0 ? Math.max(...rowNodes.map(n => n.left)) : 0;
      targetLeft = maxRowLeft + 2;
    }

    // Check for collision
    while (rowNodes.some(n => Math.abs(n.left - targetLeft) < 2)) {
      targetLeft += 2;
    }

    posMap.set(missingId, { left: targetLeft, top: targetTop });

    const person = personMap.get(missingId);
    const treeNode = treeNodes.find(n => n.id === missingId);

    allNodes.push({
      id: missingId,
      left: targetLeft,
      top: targetTop,
      gender: (person?.gender || 'male') as any,
      parents: treeNode?.parents || [],
      children: treeNode?.children || [],
      siblings: treeNode?.siblings || [],
      spouses: treeNode?.spouses || [],
      hasSubTree: false,
    });

    // ── Generate connectors for this missing node ──
    // 1. Vertical line from parents' midpoint down to this node
    const placedParents = parents.filter(pid => posMap.has(pid));
    if (placedParents.length > 0) {
      const parentPositions = placedParents.map(pid => posMap.get(pid)!);
      const parentCenters = parentPositions.map(p => p.left + 1); // center X in grid
      const parentMidX = (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2;
      const parentBottomY = parentPositions[0].top + 2; // bottom of parent node
      const childTopY = targetTop; // top of child node
      const childCenterX = targetLeft + 1;
      const midY = (parentBottomY + childTopY) / 2;

      // Check if primary already has a horizontal bar at midY from parents
      // (for existing siblings). If so, just add a drop from that bar.
      const hasExistingBar = allConnectors.some(([, cy1, , cy2]) =>
        Math.abs(cy1 - midY) < 0.1 && Math.abs(cy2 - midY) < 0.1
      );

      if (hasExistingBar) {
        // Find the existing horizontal bar and extend it if needed
        const barIdx = allConnectors.findIndex(([cx1, cy1, cx2, cy2]) =>
          Math.abs(cy1 - midY) < 0.1 && Math.abs(cy2 - midY) < 0.1 && cx1 !== cx2
        );

        if (barIdx >= 0) {
          const bar = allConnectors[barIdx];
          const barLeft = Math.min(bar[0], bar[2]);
          const barRight = Math.max(bar[0], bar[2]);

          // Extend bar to reach new child if needed
          if (childCenterX < barLeft || childCenterX > barRight) {
            const newLeft = Math.min(barLeft, childCenterX);
            const newRight = Math.max(barRight, childCenterX);
            allConnectors[barIdx] = [newLeft, bar[1], newRight, bar[3]] as const;
          }
        }

        // Drop line from bar to new child
        allConnectors.push([childCenterX, midY, childCenterX, childTopY] as const);
      } else {
        // No existing bar — create full connector set
        // Drop from parent midpoint to midY
        allConnectors.push([parentMidX, parentBottomY, parentMidX, midY] as const);
        // Horizontal to child center
        if (Math.abs(parentMidX - childCenterX) > 0.01) {
          allConnectors.push([
            Math.min(parentMidX, childCenterX), midY,
            Math.max(parentMidX, childCenterX), midY
          ] as const);
        }
        // Drop to child
        allConnectors.push([childCenterX, midY, childCenterX, childTopY] as const);
      }
    }

    // 2. Couple connector if this person has a placed spouse
    const spouses = spousesOf.get(missingId) || [];
    for (const spouseId of spouses) {
      if (posMap.has(spouseId)) {
        const sp = posMap.get(spouseId)!;
        if (sp.top === targetTop) {
          const leftPos = targetLeft < sp.left ? targetLeft : sp.left;
          const rightPos = targetLeft < sp.left ? sp.left : targetLeft;
          const coupleY = targetTop + 1; // center Y
          allConnectors.push([leftPos + 2, coupleY, rightPos, coupleY] as const);
        }
      }
    }
  }

  // ── Compute canvas size ──
  let maxLeft = 0;
  let maxTop = 0;
  for (const n of allNodes) {
    maxLeft = Math.max(maxLeft, n.left);
    maxTop = Math.max(maxTop, n.top);
  }

  return {
    canvas: {
      width: Math.max(primary.canvas.width, maxLeft + 4),
      height: Math.max(primary.canvas.height, maxTop + 4),
    },
    nodes: allNodes,
    connectors: allConnectors,
  };
}
