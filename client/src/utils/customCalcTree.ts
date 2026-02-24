/**
 * Custom Family Tree Layout Engine
 *
 * Replaces `relatives-tree` library. Draws tree top-down by generations,
 * guaranteeing 100% node coverage for two-family-line trees.
 *
 * Layout principle:
 *  - Gen -2: Grandparents (paternal LEFT, maternal RIGHT)
 *  - Gen -1: Their children (uncles left, FATHER+MOTHER center, aunts right)
 *  - Gen  0: Owner + siblings + spouses (owner center)
 *  - Gen +1: Children
 */
import type { Person, Relationship } from '../types';

// Grid constants (for node positioning)
const NODE_SPAN = 2;    // node width in grid units
const GAP = 0.5;         // gap between nodes (tighter for couples)
const SLOT = NODE_SPAN + GAP; // total slot width (2.5)
const ROW_HEIGHT = 3;    // vertical distance between generation rows

// Connectors are now in GRID UNITS (like relatives-tree v1A).
// FamilyTreeLayout multiplies by HALF_W/HALF_H to convert to pixels.

// ═══════════ Output types (compatible with relatives-tree) ═══════════

interface LayoutNode {
  id: string;
  left: number;
  top: number;
  gender: 'male' | 'female';
  parents: ReadonlyArray<{ id: string; type: string }>;
  children: ReadonlyArray<{ id: string; type: string }>;
  siblings: ReadonlyArray<{ id: string; type: string }>;
  spouses: ReadonlyArray<{ id: string; type: string }>;
  hasSubTree: boolean;
}

interface LayoutResult {
  canvas: { width: number; height: number };
  nodes: LayoutNode[];
  connectors: Array<readonly [number, number, number, number]>;
}

// ═══════════ Internal types ═══════════

interface SpouseInfo {
  spouseId: string;
  isDivorced: boolean;
}

interface FamilyUnit {
  parents: string[];   // 1 or 2 person IDs
  children: string[];  // child IDs
}

// ═══════════ Main function ═══════════

export function customCalcTree(
  persons: Person[],
  relationships: Relationship[],
  ownerPersonId: string
): LayoutResult {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // ── Phase 1: Build adjacency maps ──
  const parentsOf = new Map<string, string[]>();     // childId → parentIds
  const childrenOf = new Map<string, string[]>();     // parentId → childIds
  const spousesOf = new Map<string, SpouseInfo[]>();  // personId → spouses

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
      const isDivorced = rel.coupleStatus === 'divorced';
      if (!spousesOf.has(rel.person1Id)) spousesOf.set(rel.person1Id, []);
      spousesOf.get(rel.person1Id)!.push({ spouseId: rel.person2Id, isDivorced });
      if (!spousesOf.has(rel.person2Id)) spousesOf.set(rel.person2Id, []);
      spousesOf.get(rel.person2Id)!.push({ spouseId: rel.person1Id, isDivorced });
    }
  }

  // Helper: get shared children of two parents
  const getSharedChildren = (p1: string, p2: string): string[] => {
    const c1 = new Set(childrenOf.get(p1) || []);
    const c2 = childrenOf.get(p2) || [];
    return c2.filter(c => c1.has(c));
  };

  // (getAllChildrenOfCouple removed — unused)

  // ── Phase 2: BFS generation assignment ──
  const genMap = new Map<string, number>();
  genMap.set(ownerPersonId, 0);
  const queue: string[] = [ownerPersonId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const g = genMap.get(current)!;

    // Parents → g - 1
    for (const parentId of (parentsOf.get(current) || [])) {
      if (!genMap.has(parentId)) {
        genMap.set(parentId, g - 1);
        queue.push(parentId);
      }
    }
    // Children → g + 1
    for (const childId of (childrenOf.get(current) || [])) {
      if (!genMap.has(childId)) {
        genMap.set(childId, g + 1);
        queue.push(childId);
      }
    }
    // Spouses → same generation
    for (const { spouseId } of (spousesOf.get(current) || [])) {
      if (!genMap.has(spouseId)) {
        genMap.set(spouseId, g);
        queue.push(spouseId);
      }
    }
  }

  // Assign unvisited persons to gen 0
  for (const p of persons) {
    if (!genMap.has(p.id)) {
      genMap.set(p.id, 0);
    }
  }

  // ── Phase 3: Identify owner's lineage ──
  const ownerParentIds = parentsOf.get(ownerPersonId) || [];
  const ownerFatherId = ownerParentIds.find(id => personMap.get(id)?.gender === 'male') || null;
  const ownerMotherId = ownerParentIds.find(id => personMap.get(id)?.gender === 'female') || null;

  const paternalGPIds = ownerFatherId ? (parentsOf.get(ownerFatherId) || []) : [];
  const maternalGPIds = ownerMotherId ? (parentsOf.get(ownerMotherId) || []) : [];

  // ── Phase 4: Position nodes ──
  const positions = new Map<string, { left: number; top: number }>();
  const placed = new Set<string>();

  // Compute Y from generation
  const minGen = Math.min(...Array.from(genMap.values()));
  const genToY = (gen: number) => (gen - minGen) * ROW_HEIGHT;

  const setPos = (id: string, left: number, top: number) => {
    positions.set(id, { left, top });
    placed.add(id);
  };

  // Start with a large center reference (we'll normalize later)
  const CENTER = 30;

  // ── Place owner's parents (center reference) ──
  let parentsMidX = CENTER;

  if (ownerFatherId && ownerMotherId) {
    setPos(ownerFatherId, CENTER, genToY(genMap.get(ownerFatherId)!));
    setPos(ownerMotherId, CENTER + SLOT, genToY(genMap.get(ownerMotherId)!));
    parentsMidX = CENTER + (SLOT + NODE_SPAN) / 2; // midpoint between couple
  } else if (ownerFatherId) {
    setPos(ownerFatherId, CENTER, genToY(genMap.get(ownerFatherId)!));
    parentsMidX = CENTER + NODE_SPAN / 2;
  } else if (ownerMotherId) {
    setPos(ownerMotherId, CENTER, genToY(genMap.get(ownerMotherId)!));
    parentsMidX = CENTER + NODE_SPAN / 2;
  }

  // ── Place owner's siblings + owner (centered below parents) ──
  const ownerSiblingIds: string[] = [];
  if (ownerFatherId && ownerMotherId) {
    const shared = getSharedChildren(ownerFatherId, ownerMotherId);
    for (const id of shared) {
      if (!ownerSiblingIds.includes(id)) ownerSiblingIds.push(id);
    }
  } else if (ownerFatherId) {
    for (const id of (childrenOf.get(ownerFatherId) || [])) {
      if (!ownerSiblingIds.includes(id)) ownerSiblingIds.push(id);
    }
  } else if (ownerMotherId) {
    for (const id of (childrenOf.get(ownerMotherId) || [])) {
      if (!ownerSiblingIds.includes(id)) ownerSiblingIds.push(id);
    }
  }

  // If owner not in siblings list (e.g. no parents), add them
  if (!ownerSiblingIds.includes(ownerPersonId)) {
    ownerSiblingIds.push(ownerPersonId);
  }

  // Sort: owner in center
  const ownerIdx = ownerSiblingIds.indexOf(ownerPersonId);
  if (ownerIdx > -1) {
    ownerSiblingIds.splice(ownerIdx, 1);
  }
  // Put owner in center position
  const mid = Math.floor(ownerSiblingIds.length / 2);
  ownerSiblingIds.splice(mid, 0, ownerPersonId);

  // Place siblings row with their spouses
  placeRowWithSpouses(ownerSiblingIds, ownerPersonId, parentsMidX, genToY(0), positions, placed, genMap, spousesOf, personMap);

  // ── Place paternal side (LEFT of center) ──
  if (paternalGPIds.length > 0) {
    // Get all children of paternal grandparents
    let paternalChildren: string[] = [];
    if (paternalGPIds.length === 2) {
      paternalChildren = getSharedChildren(paternalGPIds[0], paternalGPIds[1]);
    } else {
      paternalChildren = childrenOf.get(paternalGPIds[0]) || [];
    }
    // Deduplicate
    paternalChildren = [...new Set(paternalChildren)];

    // Sort: father rightmost (nearest to center), others to the left
    paternalChildren = paternalChildren.filter(id => id !== ownerFatherId);
    paternalChildren.push(ownerFatherId!); // father last (rightmost)

    // Place paternal children in gen -1 row
    // Father is already placed, position others to his left
    const fatherPos = positions.get(ownerFatherId!)!;
    let x = fatherPos.left - SLOT;
    for (let i = paternalChildren.length - 2; i >= 0; i--) {
      const childId = paternalChildren[i];
      if (!placed.has(childId)) {
        setPos(childId, x, genToY(genMap.get(childId)!));
        // Place spouse adjacent
        placeSpouseAdjacent(childId, x, genToY(genMap.get(childId)!), 'left', positions, placed, genMap, spousesOf, personMap);
        const spouse = getMainSpouse(childId, spousesOf);
        if (spouse && placed.has(spouse)) {
          x = positions.get(spouse)!.left - SLOT;
        } else {
          x -= SLOT;
        }
      } else {
        x -= SLOT;
      }
    }

    // Place paternal grandparents centered above all their children
    const allPatChildren = paternalChildren.filter(id => placed.has(id));
    if (allPatChildren.length > 0) {
      const minX = Math.min(...allPatChildren.map(id => positions.get(id)!.left));
      const maxX = Math.max(...allPatChildren.map(id => positions.get(id)!.left));
      const gpCenterX = (minX + maxX + NODE_SPAN) / 2;

      if (paternalGPIds.length === 2) {
        const gpY = genToY(genMap.get(paternalGPIds[0])!);
        const gp1X = gpCenterX - (SLOT + NODE_SPAN) / 2;
        if (!placed.has(paternalGPIds[0])) setPos(paternalGPIds[0], gp1X, gpY);
        if (!placed.has(paternalGPIds[1])) setPos(paternalGPIds[1], gp1X + SLOT, gpY);
      } else if (paternalGPIds.length === 1) {
        const gpY = genToY(genMap.get(paternalGPIds[0])!);
        if (!placed.has(paternalGPIds[0])) setPos(paternalGPIds[0], gpCenterX - NODE_SPAN / 2, gpY);
      }
    }
  }

  // ── Place maternal side (RIGHT of center) ──
  if (maternalGPIds.length > 0) {
    let maternalChildren: string[] = [];
    if (maternalGPIds.length === 2) {
      maternalChildren = getSharedChildren(maternalGPIds[0], maternalGPIds[1]);
    } else {
      maternalChildren = childrenOf.get(maternalGPIds[0]) || [];
    }
    maternalChildren = [...new Set(maternalChildren)];

    // Sort: mother leftmost (nearest to center), others to the right
    maternalChildren = maternalChildren.filter(id => id !== ownerMotherId);
    maternalChildren.unshift(ownerMotherId!); // mother first (leftmost)

    // Mother is already placed, position others to her right
    const motherPos = positions.get(ownerMotherId!)!;
    let x = motherPos.left + SLOT;
    for (let i = 1; i < maternalChildren.length; i++) {
      const childId = maternalChildren[i];
      if (!placed.has(childId)) {
        setPos(childId, x, genToY(genMap.get(childId)!));
        // Place spouse adjacent (to the right)
        placeSpouseAdjacent(childId, x, genToY(genMap.get(childId)!), 'right', positions, placed, genMap, spousesOf, personMap);
        const spouse = getMainSpouse(childId, spousesOf);
        if (spouse && placed.has(spouse)) {
          x = positions.get(spouse)!.left + SLOT;
        } else {
          x += SLOT;
        }
      } else {
        x += SLOT;
      }
    }

    // Place maternal grandparents centered above all their children
    const allMatChildren = maternalChildren.filter(id => placed.has(id));
    if (allMatChildren.length > 0) {
      const minX = Math.min(...allMatChildren.map(id => positions.get(id)!.left));
      const maxX = Math.max(...allMatChildren.map(id => positions.get(id)!.left));
      const gpCenterX = (minX + maxX + NODE_SPAN) / 2;

      if (maternalGPIds.length === 2) {
        const gpY = genToY(genMap.get(maternalGPIds[0])!);
        const gp1X = gpCenterX - (SLOT + NODE_SPAN) / 2;
        if (!placed.has(maternalGPIds[0])) setPos(maternalGPIds[0], gp1X, gpY);
        if (!placed.has(maternalGPIds[1])) setPos(maternalGPIds[1], gp1X + SLOT, gpY);
      } else if (maternalGPIds.length === 1) {
        const gpY = genToY(genMap.get(maternalGPIds[0])!);
        if (!placed.has(maternalGPIds[0])) setPos(maternalGPIds[0], gpCenterX - NODE_SPAN / 2, gpY);
      }
    }
  }

  // ── Place children below ALL placed parents ──
  // Group parents into families (co-parent pairs), sort left-to-right,
  // place each family's children strictly below them without mixing.
  const maxGen = Math.max(...Array.from(genMap.values()));
  for (let gen = minGen; gen <= maxGen; gen++) {
    // Build unique family units in this generation
    // A family = set of co-parents who share children
    const familiesInGen: Array<{
      parentIds: string[];
      centerX: number;
      unplacedChildren: string[];
    }> = [];
    const processedParents = new Set<string>();

    const personsInGen = persons
      .filter(p => genMap.get(p.id) === gen && placed.has(p.id))
      .sort((a, b) => positions.get(a.id)!.left - positions.get(b.id)!.left);

    for (const person of personsInGen) {
      if (processedParents.has(person.id)) continue;

      const allChildren = childrenOf.get(person.id) || [];
      if (allChildren.length === 0) continue;

      // Find co-parent(s) for these children
      const coParentIds = new Set<string>([person.id]);
      for (const childId of allChildren) {
        for (const pid of (parentsOf.get(childId) || [])) {
          if (placed.has(pid)) coParentIds.add(pid);
        }
      }

      // Skip if already processed this family
      const familyKey = [...coParentIds].sort().join('|');
      if (processedParents.has(familyKey)) continue;

      // Mark all parents as processed
      for (const pid of coParentIds) processedParents.add(pid);
      processedParents.add(familyKey);

      // Collect ALL shared children of this family (union of all co-parents' children)
      const familyChildrenSet = new Set<string>();
      for (const pid of coParentIds) {
        for (const cid of (childrenOf.get(pid) || [])) {
          familyChildrenSet.add(cid);
        }
      }
      const unplacedChildren = [...familyChildrenSet].filter(c => !placed.has(c));
      if (unplacedChildren.length === 0) continue;

      // Family center X
      const familyPositions = [...coParentIds].filter(id => positions.has(id));
      const familyMinX = Math.min(...familyPositions.map(id => positions.get(id)!.left));
      const familyMaxX = Math.max(...familyPositions.map(id => positions.get(id)!.left));
      const centerX = (familyMinX + familyMaxX + NODE_SPAN) / 2;

      familiesInGen.push({ parentIds: [...coParentIds], centerX, unplacedChildren });
    }

    // Sort families left-to-right by their center X
    familiesInGen.sort((a, b) => a.centerX - b.centerX);

    // Place each family's children below parents, respecting left-to-right order
    for (const family of familiesInGen) {
      const childGen = gen + 1;
      const childY = genToY(childGen);

      // Count total slots needed (children + their spouses)
      const childSlots: string[] = [];
      for (const childId of family.unplacedChildren) {
        childSlots.push(childId);
        // Check if child has a spouse to place
        const spouse = getMainSpouse(childId, spousesOf);
        if (spouse && !placed.has(spouse) && !family.unplacedChildren.includes(spouse)) {
          childSlots.push(spouse);
        }
      }

      const totalWidth = childSlots.length * NODE_SPAN + (childSlots.length - 1) * GAP;
      let startX = family.centerX - totalWidth / 2;

      for (const slotId of childSlots) {
        if (!placed.has(slotId)) {
          setPos(slotId, startX, childY);
          startX += SLOT;
        }
      }
    }
  }

  // ── Place any remaining unplaced persons ──
  let rightEdge = 0;
  for (const pos of positions.values()) {
    rightEdge = Math.max(rightEdge, pos.left + SLOT);
  }
  for (const p of persons) {
    if (!placed.has(p.id)) {
      const gen = genMap.get(p.id) || 0;
      setPos(p.id, rightEdge, genToY(gen));
      rightEdge += SLOT;
    }
  }

  // ── Phase 5: Collision resolution ──
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;
    // Group by Y (generation rows)
    const rows = new Map<number, string[]>();
    for (const [id, pos] of positions) {
      if (!rows.has(pos.top)) rows.set(pos.top, []);
      rows.get(pos.top)!.push(id);
    }

    for (const [, ids] of rows) {
      // Sort by X
      ids.sort((a, b) => positions.get(a)!.left - positions.get(b)!.left);
      for (let i = 1; i < ids.length; i++) {
        const prev = positions.get(ids[i - 1])!;
        const curr = positions.get(ids[i])!;
        const minDist = SLOT; // minimum distance between left edges
        if (curr.left - prev.left < minDist) {
          const shift = minDist - (curr.left - prev.left);
          // Shift this node and all to its right
          for (let j = i; j < ids.length; j++) {
            positions.get(ids[j])!.left += shift;
          }
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // ── Phase 6: Normalize coordinates ──
  let minLeft = Infinity;
  let minTop = Infinity;
  for (const pos of positions.values()) {
    minLeft = Math.min(minLeft, pos.left);
    minTop = Math.min(minTop, pos.top);
  }
  const padX = 1 - minLeft; // shift so min = 1
  const padY = 1 - minTop;
  for (const pos of positions.values()) {
    pos.left += padX;
    pos.top += padY;
  }

  let maxLeft = 0;
  let maxTop = 0;
  for (const pos of positions.values()) {
    maxLeft = Math.max(maxLeft, pos.left);
    maxTop = Math.max(maxTop, pos.top);
  }

  const canvas = {
    width: maxLeft + NODE_SPAN + 2, // padding
    height: maxTop + NODE_SPAN + 2,
  };

  // ── Phase 7: Generate connectors (in GRID UNITS) ──
  // Like relatives-tree: connectors in grid coords, FamilyTreeLayout multiplies by HALF_W/HALF_H.
  // Node spans: left to left+NODE_SPAN (width), top to top+NODE_SPAN (height).
  // Center of node: (left + 1, top + 1). Bottom: top + 2. Top: top.
  const connectors: Array<readonly [number, number, number, number]> = [];

  // Grid-unit helpers (NODE_SPAN = 2, so center offset = 1)
  // OVERLAP: connectors extend slightly into card area to guarantee visual contact
  // (covers border-top 5px + box-shadow visual offset)
  const OVERLAP = 0.05; // ~6px at HALF_H=130
  const nodeCenterX = (left: number) => left + 1;
  const nodeBottomConn = (top: number) => top + NODE_SPAN - OVERLAP; // connector start from parent bottom
  const nodeTopConn = (top: number) => top + OVERLAP;                // connector end at child top
  const nodeCenterY = (top: number) => top + 1;
  const nodeRight = (left: number) => left + NODE_SPAN;

  // ── Build family units from CO-PARENTS (not just couple rels) ──
  // Key insight: two people are co-parents if they share a child.
  // This catches pairs WITHOUT explicit couple relationship.
  const familyUnits: FamilyUnit[] = [];
  const childAssigned = new Set<string>(); // track which children are assigned to a unit

  // Step 1: Find all co-parent pairs by looking at each child's parents
  const coParentPairs = new Map<string, { parents: string[]; children: string[] }>();

  for (const [childId, parentIds] of parentsOf) {
    if (parentIds.length === 2) {
      // Two parents → co-parent pair
      const key = [...parentIds].sort().join('|');
      if (!coParentPairs.has(key)) {
        coParentPairs.set(key, { parents: [...parentIds].sort(), children: [] });
      }
      coParentPairs.get(key)!.children.push(childId);
      childAssigned.add(childId);
    } else if (parentIds.length === 1) {
      // Single parent — will be handled in step 2
    }
  }

  // Add co-parent family units
  for (const unit of coParentPairs.values()) {
    familyUnits.push(unit);
  }

  // Step 2: Single parents — children not yet assigned to any co-parent unit
  for (const p of persons) {
    const children = childrenOf.get(p.id) || [];
    const unassigned = children.filter(c => !childAssigned.has(c));
    if (unassigned.length > 0) {
      familyUnits.push({ parents: [p.id], children: unassigned });
      for (const c of unassigned) childAssigned.add(c);
    }
  }

  // ── Parent → children connectors ──
  for (const unit of familyUnits) {
    const parentPos = unit.parents
      .map(id => ({ id, pos: positions.get(id) }))
      .filter(p => p.pos != null) as Array<{ id: string; pos: { left: number; top: number } }>;
    const childrenWithPos = unit.children
      .filter(id => positions.has(id));

    if (parentPos.length === 0 || childrenWithPos.length === 0) continue;

    const childCenters = childrenWithPos.map(id => nodeCenterX(positions.get(id)!.left));
    const childTops = childrenWithPos.map(id => positions.get(id)!.top);

    if (parentPos.length === 2) {
      // ── Two parents: horizontal couple line + single vertical drop ──
      const p1 = parentPos[0].pos;
      const p2 = parentPos[1].pos;
      const leftParent = p1.left < p2.left ? p1 : p2;
      const rightParent = p1.left < p2.left ? p2 : p1;

      // Horizontal line between parents at their centerY
      const coupleY = nodeCenterY(leftParent.top);
      connectors.push([nodeRight(leftParent.left), coupleY, rightParent.left, coupleY] as const);

      // Drop point = midpoint between parents' centers
      const dropX = (nodeCenterX(leftParent.left) + nodeCenterX(rightParent.left)) / 2;
      const parentBotY = Math.max(nodeBottomConn(p1.top), nodeBottomConn(p2.top));
      const childTopY = Math.min(...childTops.map(t => nodeTopConn(t)));
      const midY = (parentBotY + childTopY) / 2;

      // Vertical from couple line down to horizontal distribution bar
      connectors.push([dropX, coupleY, dropX, midY] as const);

      if (childCenters.length === 1) {
        const cx = childCenters[0];
        if (Math.abs(dropX - cx) > 0.01) {
          connectors.push([dropX, midY, cx, midY] as const);
        }
        connectors.push([cx, midY, cx, childTopY] as const);
      } else {
        const leftX = Math.min(...childCenters);
        const rightX = Math.max(...childCenters);
        // Horizontal distribution bar
        connectors.push([Math.min(leftX, dropX), midY, Math.max(rightX, dropX), midY] as const);
        // Drops to each child
        for (const cx of childCenters) {
          connectors.push([cx, midY, cx, childTopY] as const);
        }
      }
    } else {
      // ── Single parent: vertical drop from parent center ──
      const p = parentPos[0].pos;
      const dropX = nodeCenterX(p.left);
      const parentBotY = nodeBottomConn(p.top);
      const childTopY = Math.min(...childTops.map(t => nodeTopConn(t)));
      const midY = (parentBotY + childTopY) / 2;

      // Vertical from parent bottom to midpoint
      connectors.push([dropX, parentBotY, dropX, midY] as const);

      if (childCenters.length === 1) {
        const cx = childCenters[0];
        if (Math.abs(dropX - cx) > 0.01) {
          connectors.push([dropX, midY, cx, midY] as const);
        }
        connectors.push([cx, midY, cx, childTopY] as const);
      } else {
        const leftX = Math.min(...childCenters);
        const rightX = Math.max(...childCenters);
        connectors.push([Math.min(leftX, dropX), midY, Math.max(rightX, dropX), midY] as const);
        for (const cx of childCenters) {
          connectors.push([cx, midY, cx, childTopY] as const);
        }
      }
    }
  }

  // ── Couple connectors (for pairs WITHOUT shared children) ──
  // Co-parent couples already got their horizontal line above.
  // Only add couple line for childless couples or divorced pairs without shared children.
  const drawnCouplePairs = new Set<string>();
  for (const unit of familyUnits) {
    if (unit.parents.length === 2) {
      drawnCouplePairs.add([...unit.parents].sort().join('|'));
    }
  }

  for (const rel of relationships) {
    if (rel.category !== 'couple') continue;
    const key = [rel.person1Id, rel.person2Id].sort().join('|');
    if (drawnCouplePairs.has(key)) continue; // already drawn by family unit

    const p1 = positions.get(rel.person1Id);
    const p2 = positions.get(rel.person2Id);
    if (!p1 || !p2) continue;
    if (p1.top !== p2.top) continue; // only same-row couples

    const y = nodeCenterY(p1.top);
    const left = p1.left < p2.left ? p1 : p2;
    const right = p1.left < p2.left ? p2 : p1;
    connectors.push([nodeRight(left.left), y, right.left, y] as const);
  }

  // ── Build output ──
  const nodes: LayoutNode[] = persons.map(p => {
    const pos = positions.get(p.id) || { left: 0, top: 0 };
    return {
      id: p.id,
      left: pos.left,
      top: pos.top,
      gender: p.gender as 'male' | 'female',
      parents: (parentsOf.get(p.id) || []).map(id => ({ id, type: 'blood' })),
      children: (childrenOf.get(p.id) || []).map(id => ({ id, type: 'blood' })),
      siblings: [],
      spouses: (spousesOf.get(p.id) || []).map(s => ({ id: s.spouseId, type: s.isDivorced ? 'divorced' : 'married' })),
      hasSubTree: false,
    };
  });

  return { canvas, nodes, connectors };
}

// ═══════════ Helper functions ═══════════

function getMainSpouse(
  personId: string,
  spousesOf: Map<string, SpouseInfo[]>
): string | null {
  const spouses = spousesOf.get(personId) || [];
  // Prefer non-divorced spouse
  const married = spouses.find(s => !s.isDivorced);
  if (married) return married.spouseId;
  return spouses.length > 0 ? spouses[0].spouseId : null;
}

function placeSpouseAdjacent(
  personId: string,
  personX: number,
  personY: number,
  side: 'left' | 'right',
  positions: Map<string, { left: number; top: number }>,
  placed: Set<string>,
  _genMap: Map<string, number>,
  spousesOf: Map<string, SpouseInfo[]>,
  _personMap: Map<string, Person>
) {
  const spouses = spousesOf.get(personId) || [];
  for (const { spouseId } of spouses) {
    if (placed.has(spouseId)) continue;
    const x = side === 'right' ? personX + SLOT : personX - SLOT;
    positions.set(spouseId, { left: x, top: personY });
    placed.add(spouseId);
  }
}

function placeRowWithSpouses(
  orderedIds: string[],
  ownerId: string,
  centerX: number,
  y: number,
  positions: Map<string, { left: number; top: number }>,
  placed: Set<string>,
  _genMap: Map<string, number>,
  spousesOf: Map<string, SpouseInfo[]>,
  _personMap: Map<string, Person>
) {
  // Build list of slots: [person, spouse?, person, spouse?, ...]
  const slots: string[] = [];
  for (const id of orderedIds) {
    // Place spouse to the LEFT of person (for non-owner), or both sides for owner
    const spouses = spousesOf.get(id) || [];
    const mainSpouse = spouses.find(s => !s.isDivorced);
    const exSpouse = spouses.find(s => s.isDivorced);

    if (id === ownerId) {
      // Ex-spouse LEFT, owner CENTER, current spouse RIGHT
      if (exSpouse && !placed.has(exSpouse.spouseId)) slots.push(exSpouse.spouseId);
      slots.push(id);
      if (mainSpouse && !placed.has(mainSpouse.spouseId)) slots.push(mainSpouse.spouseId);
    } else {
      slots.push(id);
      // Spouse adjacent to the right
      if (mainSpouse && !placed.has(mainSpouse.spouseId)) slots.push(mainSpouse.spouseId);
      if (exSpouse && !placed.has(exSpouse.spouseId)) slots.push(exSpouse.spouseId);
    }
  }

  // Find owner's index in slots for centering
  const ownerSlotIdx = slots.indexOf(ownerId);
  const startX = centerX - (ownerSlotIdx * SLOT + NODE_SPAN / 2);

  for (let i = 0; i < slots.length; i++) {
    const id = slots[i];
    if (!placed.has(id)) {
      positions.set(id, { left: startX + i * SLOT, top: y });
      placed.add(id);
    }
  }
}
