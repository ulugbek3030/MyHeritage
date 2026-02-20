/**
 * Custom Family Tree Layout Engine v3
 *
 * Fully replaces `relatives-tree` library. Draws tree top-down by generations
 * with correct placement rules:
 *   - Owner centered, older siblings LEFT, younger RIGHT (by birthYear)
 *   - Each person with spouse(s): ex LEFT, person, current spouse RIGHT
 *   - Father's siblings ALL LEFT of father, mother's siblings ALL RIGHT of mother
 *   - Children centered below their parent couple
 *   - Grandparents centered above their children group
 *   - hasSubTree flag for spouses with external family
 *
 * Output: grid-unit coordinates. FamilyTreeLayout multiplies by HALF_W/HALF_H.
 */
import type { Person, Relationship } from '../types';

// ═══════════ Grid Constants ═══════════
const NODE_SPAN = 2;       // node width/height in grid units
const SIBLING_GAP = 0.5;   // gap between nodes
const SLOT = NODE_SPAN + SIBLING_GAP; // 2.5 — minimum distance between node left edges
const ROW_HEIGHT = 3;      // vertical distance between generation rows

// ═══════════ Output Types ═══════════

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

interface MultiPassResult {
  canvas: { width: number; height: number };
  nodes: LayoutNode[];
  connectors: Array<readonly [number, number, number, number]>;
}

// ═══════════ Internal Types ═══════════

interface SpouseInfo {
  spouseId: string;
  isDivorced: boolean;
}

// ═══════════ Main Function ═══════════

export function calcTreeMultiPass(
  persons: Person[],
  relationships: Relationship[],
  ownerPersonId: string
): MultiPassResult {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // ══════════════════════════════════════════════
  // Phase 1: Build Adjacency Maps
  // ══════════════════════════════════════════════
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, SpouseInfo[]>();

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
    return (childrenOf.get(p2) || []).filter(c => c1.has(c));
  };

  // Helper: get all children of a person (from all partners)
  const getAllChildren = (id: string): string[] => childrenOf.get(id) || [];

  // Helper: get siblings (share at least one parent)
  const getSiblings = (id: string): string[] => {
    const parents = parentsOf.get(id) || [];
    const sibs = new Set<string>();
    for (const pid of parents) {
      for (const cid of (childrenOf.get(pid) || [])) {
        if (cid !== id) sibs.add(cid);
      }
    }
    return [...sibs];
  };

  // Helper: get current (non-divorced) spouse
  const getCurrentSpouse = (id: string): string | null => {
    const sp = (spousesOf.get(id) || []).find(s => !s.isDivorced);
    return sp ? sp.spouseId : null;
  };

  // Helper: get ex (divorced) spouse
  const getExSpouse = (id: string): string | null => {
    const sp = (spousesOf.get(id) || []).find(s => s.isDivorced);
    return sp ? sp.spouseId : null;
  };

  // ══════════════════════════════════════════════
  // Phase 2: BFS Generation Assignment
  // ══════════════════════════════════════════════
  const genMap = new Map<string, number>();
  genMap.set(ownerPersonId, 0);
  const queue: string[] = [ownerPersonId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const g = genMap.get(current)!;

    for (const parentId of (parentsOf.get(current) || [])) {
      if (!genMap.has(parentId)) {
        genMap.set(parentId, g - 1);
        queue.push(parentId);
      }
    }
    for (const childId of (childrenOf.get(current) || [])) {
      if (!genMap.has(childId)) {
        genMap.set(childId, g + 1);
        queue.push(childId);
      }
    }
    for (const { spouseId } of (spousesOf.get(current) || [])) {
      if (!genMap.has(spouseId)) {
        genMap.set(spouseId, g);
        queue.push(spouseId);
      }
    }
  }

  // Assign unvisited persons
  for (const p of persons) {
    if (!genMap.has(p.id)) genMap.set(p.id, 0);
  }

  const minGen = Math.min(...Array.from(genMap.values()));
  const genToY = (gen: number) => (gen - minGen) * ROW_HEIGHT;

  // ══════════════════════════════════════════════
  // Phase 3: Owner Lineage
  // ══════════════════════════════════════════════
  const ownerParents = parentsOf.get(ownerPersonId) || [];
  const ownerFatherId = ownerParents.find(id => personMap.get(id)?.gender === 'male') || null;
  const ownerMotherId = ownerParents.find(id => personMap.get(id)?.gender === 'female') || null;

  const paternalGPIds = ownerFatherId ? (parentsOf.get(ownerFatherId) || []) : [];
  const maternalGPIds = ownerMotherId ? (parentsOf.get(ownerMotherId) || []) : [];

  // Build ownerLineage set — all direct ancestors and their spouses
  const ownerLineage = new Set<string>();
  ownerLineage.add(ownerPersonId);
  if (ownerFatherId) ownerLineage.add(ownerFatherId);
  if (ownerMotherId) ownerLineage.add(ownerMotherId);
  for (const id of paternalGPIds) ownerLineage.add(id);
  for (const id of maternalGPIds) ownerLineage.add(id);

  // ══════════════════════════════════════════════
  // Phase 4: Placement
  // ══════════════════════════════════════════════
  const positions = new Map<string, { left: number; top: number }>();
  const placed = new Set<string>();

  const setPos = (id: string, left: number, top: number) => {
    positions.set(id, { left, top });
    placed.add(id);
  };

  const CENTER = 50; // large center, normalized later

  // ── Sort siblings by age ──
  // Older LEFT, younger RIGHT; no birthYear → at end
  const sortByAge = (ids: string[], centerId: string): string[] => {
    const centerPerson = personMap.get(centerId);
    const centerYear = centerPerson?.birthYear ?? 9999;

    const others = ids.filter(id => id !== centerId);

    const withYear = others.filter(id => personMap.get(id)?.birthYear != null);
    const noYear = others.filter(id => personMap.get(id)?.birthYear == null);

    withYear.sort((a, b) => (personMap.get(a)!.birthYear! - personMap.get(b)!.birthYear!));

    const older = withYear.filter(id => (personMap.get(id)!.birthYear!) <= centerYear);
    const younger = withYear.filter(id => (personMap.get(id)!.birthYear!) > centerYear);

    // older (ascending) | CENTER | younger (ascending) | noYear
    return [...older, centerId, ...younger, ...noYear];
  };

  // ── Expand person with spouses: [ex, person, currentSpouse] ──
  const expandWithSpouses = (id: string): string[] => {
    const result: string[] = [];
    const ex = getExSpouse(id);
    const current = getCurrentSpouse(id);
    if (ex && !placed.has(ex)) result.push(ex);
    result.push(id);
    if (current && !placed.has(current)) result.push(current);
    return result;
  };

  // ── Place a row of slots centered on a reference X ──
  const placeSlots = (slots: string[], centerIdx: number, centerX: number, y: number) => {
    // centerIdx is the index in slots that should be at centerX
    const startX = centerX - centerIdx * SLOT;
    for (let i = 0; i < slots.length; i++) {
      const id = slots[i];
      if (!placed.has(id)) {
        setPos(id, startX + i * SLOT, y);
      }
    }
  };

  // ════════════════════════════════════════
  // 4A. Owner's Row (Gen 0)
  // ════════════════════════════════════════

  // Get owner's siblings (children of owner's parents)
  let ownerSiblingIds: string[] = [];
  if (ownerFatherId && ownerMotherId) {
    ownerSiblingIds = getSharedChildren(ownerFatherId, ownerMotherId);
  } else if (ownerFatherId) {
    ownerSiblingIds = [...(childrenOf.get(ownerFatherId) || [])];
  } else if (ownerMotherId) {
    ownerSiblingIds = [...(childrenOf.get(ownerMotherId) || [])];
  }
  if (!ownerSiblingIds.includes(ownerPersonId)) {
    ownerSiblingIds.push(ownerPersonId);
  }
  // Deduplicate
  ownerSiblingIds = [...new Set(ownerSiblingIds)];

  // Sort by age: older LEFT, owner CENTER, younger RIGHT
  const sortedOwnerSiblings = sortByAge(ownerSiblingIds, ownerPersonId);

  // Expand each sibling with their spouses
  const ownerRowSlots: string[] = [];
  let ownerSlotIdx = -1;

  for (const sibId of sortedOwnerSiblings) {
    const expanded = expandWithSpouses(sibId);
    if (sibId === ownerPersonId) {
      ownerSlotIdx = ownerRowSlots.length + expanded.indexOf(ownerPersonId);
    }
    ownerRowSlots.push(...expanded);
  }

  const ownerY = genToY(0);
  placeSlots(ownerRowSlots, ownerSlotIdx, CENTER, ownerY);

  // ════════════════════════════════════════
  // 4B. Children (Gen +1, +2, ...)
  // ════════════════════════════════════════

  const placeChildrenBelow = (parentIds: string[], gen: number) => {
    if (parentIds.length === 0) return;

    // Find the couple's center X
    const parentPositions = parentIds.filter(id => placed.has(id)).map(id => positions.get(id)!);
    if (parentPositions.length === 0) return;

    const parentMinX = Math.min(...parentPositions.map(p => p.left));
    const parentMaxX = Math.max(...parentPositions.map(p => p.left));
    const coupleCenterX = (parentMinX + parentMaxX + NODE_SPAN) / 2;

    // Get shared children
    let children: string[];
    if (parentIds.length === 2) {
      children = getSharedChildren(parentIds[0], parentIds[1]);
    } else {
      children = getAllChildren(parentIds[0]);
    }
    children = children.filter(c => !placed.has(c));
    if (children.length === 0) return;

    // Expand children with their spouses
    const childSlots: string[] = [];
    const childCenterApprox = Math.floor(children.length / 2);
    for (const childId of children) {
      childSlots.push(...expandWithSpouses(childId));
    }

    // Center children under couple
    // Find the slot index of the center child
    let centerChildSlotIdx = 0;
    let count = 0;
    for (const childId of children) {
      const expanded = expandWithSpouses(childId);
      if (count === childCenterApprox) {
        centerChildSlotIdx = centerChildSlotIdx + expanded.indexOf(childId);
        break;
      }
      centerChildSlotIdx += expanded.length;
      count++;
    }

    const childY = genToY(gen);
    // Rebuild slots since expandWithSpouses may return different results now
    const finalSlots: string[] = [];
    let finalCenterIdx = 0;
    count = 0;
    for (const childId of children) {
      const exp = expandWithSpouses(childId);
      if (count === childCenterApprox) {
        finalCenterIdx = finalSlots.length + exp.indexOf(childId);
      }
      finalSlots.push(...exp);
      count++;
    }

    const startX = coupleCenterX - NODE_SPAN / 2 - finalCenterIdx * SLOT;
    for (let i = 0; i < finalSlots.length; i++) {
      const id = finalSlots[i];
      if (!placed.has(id)) {
        setPos(id, startX + i * SLOT, childY);
      }
    }

    // Recursively place grandchildren
    for (const childId of children) {
      const childSpouse = getCurrentSpouse(childId);
      if (childSpouse && placed.has(childSpouse)) {
        placeChildrenBelow([childId, childSpouse], gen + 1);
      } else {
        const childChildren = getAllChildren(childId);
        if (childChildren.some(c => !placed.has(c))) {
          placeChildrenBelow([childId], gen + 1);
        }
      }
    }
  };

  // Place children for each person on owner's row who has children
  for (const sibId of sortedOwnerSiblings) {
    const currentSp = getCurrentSpouse(sibId);
    const exSp = getExSpouse(sibId);

    // Children with current spouse
    if (currentSp) {
      const shared = getSharedChildren(sibId, currentSp);
      if (shared.some(c => !placed.has(c))) {
        placeChildrenBelow([sibId, currentSp], 1);
      }
    }
    // Children with ex spouse
    if (exSp) {
      const shared = getSharedChildren(sibId, exSp);
      if (shared.some(c => !placed.has(c))) {
        placeChildrenBelow([sibId, exSp], 1);
      }
    }
    // Children without known co-parent
    const allCh = getAllChildren(sibId).filter(c => !placed.has(c));
    if (allCh.length > 0) {
      placeChildrenBelow([sibId], 1);
    }
  }

  // ════════════════════════════════════════
  // 4C. Parents (Gen -1)
  // ════════════════════════════════════════

  // Father's siblings → ALL LEFT of father
  // Mother's siblings → ALL RIGHT of mother
  // Father and mother are centered above owner's sibling group

  // First, center father+mother above the owner sibling group
  const ownerGroupLefts = sortedOwnerSiblings
    .filter(id => placed.has(id))
    .map(id => positions.get(id)!.left);

  let sibGroupCenterX = CENTER;
  if (ownerGroupLefts.length > 0) {
    const minX = Math.min(...ownerGroupLefts);
    const maxX = Math.max(...ownerGroupLefts);
    sibGroupCenterX = (minX + maxX + NODE_SPAN) / 2;
  }

  const parentsY = genToY(-1);

  if (ownerFatherId && ownerMotherId) {
    // Place father and mother as a couple, with their midpoint of centers = sibGroupCenterX
    // midpoint of centers = (fatherLeft+1 + motherLeft+1)/2 = sibGroupCenterX
    // motherLeft = fatherLeft + SLOT
    // => fatherLeft = sibGroupCenterX - 1 - SLOT/2
    const fatherX = sibGroupCenterX - 1 - SLOT / 2;
    const motherX = fatherX + SLOT;
    setPos(ownerFatherId, fatherX, parentsY);
    setPos(ownerMotherId, motherX, parentsY);
  } else if (ownerFatherId) {
    setPos(ownerFatherId, sibGroupCenterX - NODE_SPAN / 2, parentsY);
  } else if (ownerMotherId) {
    setPos(ownerMotherId, sibGroupCenterX - NODE_SPAN / 2, parentsY);
  }

  // Place father's siblings to the LEFT
  if (ownerFatherId) {
    const fatherSibs = getSiblings(ownerFatherId);
    // Sort: oldest leftmost (ascending birthYear)
    fatherSibs.sort((a, b) => {
      const ya = personMap.get(a)?.birthYear ?? 9999;
      const yb = personMap.get(b)?.birthYear ?? 9999;
      return ya - yb;
    });

    const fatherPos = positions.get(ownerFatherId);
    if (fatherPos) {
      // Place from right to left (rightmost uncle closest to father)
      let x = fatherPos.left;
      for (let i = fatherSibs.length - 1; i >= 0; i--) {
        const sibId = fatherSibs[i];
        if (placed.has(sibId)) continue;

        // Expand: [ex, sib, currentSpouse] — spouse goes to LEFT (away from center)
        const exp: string[] = [];
        const current = getCurrentSpouse(sibId);
        const ex = getExSpouse(sibId);
        if (current && !placed.has(current)) exp.push(current);
        exp.push(sibId);
        if (ex && !placed.has(ex)) exp.push(ex);

        // Place the group to the left of current x
        x -= exp.length * SLOT;
        for (let j = 0; j < exp.length; j++) {
          if (!placed.has(exp[j])) {
            setPos(exp[j], x + j * SLOT, parentsY);
          }
        }
      }
    }
  }

  // Place mother's siblings to the RIGHT
  if (ownerMotherId) {
    const motherSibs = getSiblings(ownerMotherId);
    // Sort: oldest closest to mother (ascending birthYear)
    motherSibs.sort((a, b) => {
      const ya = personMap.get(a)?.birthYear ?? 9999;
      const yb = personMap.get(b)?.birthYear ?? 9999;
      return ya - yb;
    });

    const motherPos = positions.get(ownerMotherId);
    if (motherPos) {
      let x = motherPos.left + SLOT; // start after mother
      for (let i = 0; i < motherSibs.length; i++) {
        const sibId = motherSibs[i];
        if (placed.has(sibId)) continue;

        // Expand: [sib, currentSpouse, ex] — spouse goes to RIGHT (away from center)
        const exp: string[] = [];
        const ex = getExSpouse(sibId);
        if (ex && !placed.has(ex)) exp.push(ex);
        exp.push(sibId);
        const current = getCurrentSpouse(sibId);
        if (current && !placed.has(current)) exp.push(current);

        for (let j = 0; j < exp.length; j++) {
          if (!placed.has(exp[j])) {
            setPos(exp[j], x + j * SLOT, parentsY);
          }
        }
        x += exp.length * SLOT;
      }
    }
  }

  // Place children of uncles/aunts (in Gen 0, but must not overlap owner siblings)
  const placeUncleAuntChildren = () => {
    if (!ownerFatherId && !ownerMotherId) return;

    const uncleAuntIds: string[] = [];
    if (ownerFatherId) uncleAuntIds.push(...getSiblings(ownerFatherId));
    if (ownerMotherId) uncleAuntIds.push(...getSiblings(ownerMotherId));

    for (const uaId of uncleAuntIds) {
      if (!placed.has(uaId)) continue;
      const sp = getCurrentSpouse(uaId);
      if (sp && placed.has(sp)) {
        placeChildrenBelow([uaId, sp], genMap.get(uaId)! + 1);
      } else {
        const ch = getAllChildren(uaId).filter(c => !placed.has(c));
        if (ch.length > 0) {
          placeChildrenBelow([uaId], genMap.get(uaId)! + 1);
        }
      }
    }
  };
  placeUncleAuntChildren();

  // ════════════════════════════════════════
  // 4D. Grandparents (Gen -2)
  // ════════════════════════════════════════

  const placeGrandparents = (gpIds: string[], childGroupIds: string[]) => {
    if (gpIds.length === 0) return;

    // Center GPs above their children group
    const childPositions = childGroupIds.filter(id => placed.has(id)).map(id => positions.get(id)!);
    if (childPositions.length === 0) return;

    const minX = Math.min(...childPositions.map(p => p.left));
    const maxX = Math.max(...childPositions.map(p => p.left));
    const groupCenterX = (minX + maxX + NODE_SPAN) / 2;

    const gpY = genToY(-2);

    if (gpIds.length === 2) {
      // midpoint of centers = groupCenterX
      // (gp1X+1 + gp2X+1)/2 = groupCenterX, gp2X = gp1X + SLOT
      // => gp1X = groupCenterX - 1 - SLOT/2
      const gp1X = groupCenterX - 1 - SLOT / 2;
      if (!placed.has(gpIds[0])) setPos(gpIds[0], gp1X, gpY);
      if (!placed.has(gpIds[1])) setPos(gpIds[1], gp1X + SLOT, gpY);
    } else if (gpIds.length === 1) {
      if (!placed.has(gpIds[0])) setPos(gpIds[0], groupCenterX - NODE_SPAN / 2, gpY);
    }
  };

  // Paternal grandparents centered above father + father's siblings
  if (paternalGPIds.length > 0 && ownerFatherId) {
    const fatherSibs = getSiblings(ownerFatherId);
    const paternalGroup = [ownerFatherId, ...fatherSibs];
    // Include their spouses in the group for centering
    const fullGroup: string[] = [];
    for (const id of paternalGroup) {
      if (placed.has(id)) fullGroup.push(id);
      const sp = getCurrentSpouse(id);
      if (sp && placed.has(sp)) fullGroup.push(sp);
      const ex = getExSpouse(id);
      if (ex && placed.has(ex)) fullGroup.push(ex);
    }
    placeGrandparents(paternalGPIds, fullGroup.length > 0 ? fullGroup : paternalGroup);
  }

  // Maternal grandparents centered above mother + mother's siblings
  if (maternalGPIds.length > 0 && ownerMotherId) {
    const motherSibs = getSiblings(ownerMotherId);
    const maternalGroup = [ownerMotherId, ...motherSibs];
    const fullGroup: string[] = [];
    for (const id of maternalGroup) {
      if (placed.has(id)) fullGroup.push(id);
      const sp = getCurrentSpouse(id);
      if (sp && placed.has(sp)) fullGroup.push(sp);
      const ex = getExSpouse(id);
      if (ex && placed.has(ex)) fullGroup.push(ex);
    }
    placeGrandparents(maternalGPIds, fullGroup.length > 0 ? fullGroup : maternalGroup);
  }

  // ════════════════════════════════════════
  // Place any remaining unplaced persons
  // ════════════════════════════════════════
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

  // ══════════════════════════════════════════════
  // Phase 5: Collision Detection
  // ══════════════════════════════════════════════
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;

    const rows = new Map<number, string[]>();
    for (const [id, pos] of positions) {
      if (!rows.has(pos.top)) rows.set(pos.top, []);
      rows.get(pos.top)!.push(id);
    }

    for (const [, ids] of rows) {
      ids.sort((a, b) => positions.get(a)!.left - positions.get(b)!.left);
      for (let i = 1; i < ids.length; i++) {
        const prev = positions.get(ids[i - 1])!;
        const curr = positions.get(ids[i])!;
        if (curr.left - prev.left < SLOT) {
          const shift = SLOT - (curr.left - prev.left);
          for (let j = i; j < ids.length; j++) {
            positions.get(ids[j])!.left += shift;
          }
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // ══════════════════════════════════════════════
  // Phase 6: Normalize coordinates
  // ══════════════════════════════════════════════
  let minLeft = Infinity;
  let minTop = Infinity;
  for (const pos of positions.values()) {
    minLeft = Math.min(minLeft, pos.left);
    minTop = Math.min(minTop, pos.top);
  }
  const padX = 1 - minLeft;
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
    width: maxLeft + NODE_SPAN + 2,
    height: maxTop + NODE_SPAN + 2,
  };

  // ══════════════════════════════════════════════
  // Phase 7: Generate Connectors (grid units)
  // ══════════════════════════════════════════════
  const connectors: Array<readonly [number, number, number, number]> = [];

  // Grid helpers
  const nodeCenterX = (left: number) => left + 1;
  const nodeBottom = (top: number) => top + NODE_SPAN;
  const nodeTop = (top: number) => top;
  const nodeCenterY = (top: number) => top + 1;
  const nodeRight = (left: number) => left + NODE_SPAN;

  // Build family units by grouping children by their parent set.
  // This handles both explicit couples AND implicit co-parents (no couple relationship).
  interface FamilyUnit {
    parents: string[];
    children: string[];
  }
  const familyUnits: FamilyUnit[] = [];

  // Group children by their sorted parent IDs
  const parentKeyToChildren = new Map<string, string[]>();
  const parentKeyToParents = new Map<string, string[]>();

  for (const [childId, parentIds] of parentsOf) {
    const key = [...parentIds].sort().join('+');
    if (!parentKeyToChildren.has(key)) {
      parentKeyToChildren.set(key, []);
      parentKeyToParents.set(key, [...parentIds]);
    }
    parentKeyToChildren.get(key)!.push(childId);
  }

  for (const [key] of parentKeyToChildren) {
    familyUnits.push({
      parents: parentKeyToParents.get(key)!,
      children: parentKeyToChildren.get(key)!,
    });
  }

  // Parent → children connectors
  for (const unit of familyUnits) {
    const parentPos = unit.parents
      .filter(id => positions.has(id))
      .map(id => positions.get(id)!);
    const childIds = unit.children.filter(id => positions.has(id));
    const childCenters = childIds.map(id => nodeCenterX(positions.get(id)!.left));

    if (parentPos.length === 0 || childIds.length === 0) continue;

    const parentCenters = parentPos.map(p => nodeCenterX(p.left));
    const dropX = (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2;
    const parentBotY = nodeBottom(parentPos[0].top);
    const childTopY = nodeTop(positions.get(childIds[0])!.top);
    const midY = (parentBotY + childTopY) / 2;

    // Vertical drop from parent bottom to midpoint
    connectors.push([dropX, parentBotY, dropX, midY]);

    if (childCenters.length === 1) {
      const cx = childCenters[0];
      if (Math.abs(dropX - cx) > 0.01) {
        connectors.push([dropX, midY, cx, midY]);
      }
      connectors.push([cx, midY, cx, childTopY]);
    } else {
      const leftX = Math.min(...childCenters);
      const rightX = Math.max(...childCenters);
      // Horizontal bar spanning from leftmost child to rightmost, including drop point
      connectors.push([Math.min(leftX, dropX), midY, Math.max(rightX, dropX), midY]);
      // Vertical drops to each child
      for (const cx of childCenters) {
        connectors.push([cx, midY, cx, childTopY]);
      }
    }
  }

  // Couple connectors (horizontal line between spouses/co-parents at center Y)
  // Track which pairs already have a couple connector to avoid duplicates
  const coupleConnectorSet = new Set<string>();

  const addCoupleConnector = (id1: string, id2: string) => {
    const key = [id1, id2].sort().join('+');
    if (coupleConnectorSet.has(key)) return;
    coupleConnectorSet.add(key);

    const p1 = positions.get(id1);
    const p2 = positions.get(id2);
    if (!p1 || !p2) return;
    if (p1.top !== p2.top) return;

    const y = nodeCenterY(p1.top);
    const left = p1.left < p2.left ? p1 : p2;
    const right = p1.left < p2.left ? p2 : p1;
    connectors.push([nodeRight(left.left), y, right.left, y]);
  };

  // 1. Explicit couple relationships
  for (const rel of relationships) {
    if (rel.category !== 'couple') continue;
    addCoupleConnector(rel.person1Id, rel.person2Id);
  }

  // 2. Implicit co-parents (share children but no couple relationship)
  for (const unit of familyUnits) {
    if (unit.parents.length === 2) {
      addCoupleConnector(unit.parents[0], unit.parents[1]);
    }
  }

  // ══════════════════════════════════════════════
  // Build hasSubTree flags
  // ══════════════════════════════════════════════
  const hasSubTreeSet = new Set<string>();
  // A spouse of someone in ownerLineage has hasSubTree if they have parents/siblings NOT in ownerLineage
  for (const id of ownerLineage) {
    for (const { spouseId } of (spousesOf.get(id) || [])) {
      if (ownerLineage.has(spouseId)) continue; // both in lineage (e.g. mother is in lineage)
      // Check if spouse has parents or siblings not in our tree's direct lineage
      const spouseParents = parentsOf.get(spouseId) || [];
      const spouseSibs = getSiblings(spouseId);
      if (spouseParents.length > 0 || spouseSibs.length > 0) {
        // Only flag if those relatives are NOT in our placed tree
        const hasExternal = [...spouseParents, ...spouseSibs].some(rid => !ownerLineage.has(rid));
        if (hasExternal) hasSubTreeSet.add(spouseId);
      }
    }
  }

  // Also check spouses of uncles/aunts
  const uncleAuntIds: string[] = [];
  if (ownerFatherId) uncleAuntIds.push(...getSiblings(ownerFatherId));
  if (ownerMotherId) uncleAuntIds.push(...getSiblings(ownerMotherId));
  for (const uaId of uncleAuntIds) {
    for (const { spouseId } of (spousesOf.get(uaId) || [])) {
      if (ownerLineage.has(spouseId)) continue;
      const spouseParents = parentsOf.get(spouseId) || [];
      const spouseSibs = getSiblings(spouseId);
      if (spouseParents.length > 0 || spouseSibs.length > 0) {
        hasSubTreeSet.add(spouseId);
      }
    }
  }

  // ══════════════════════════════════════════════
  // Build Output
  // ══════════════════════════════════════════════
  const nodes: LayoutNode[] = persons.map(p => {
    const pos = positions.get(p.id) || { left: 0, top: 0 };
    return {
      id: p.id,
      left: pos.left,
      top: pos.top,
      gender: p.gender,
      parents: (parentsOf.get(p.id) || []).map(id => ({ id, type: 'blood' })),
      children: (childrenOf.get(p.id) || []).map(id => ({ id, type: 'blood' })),
      siblings: getSiblings(p.id).map(id => ({ id, type: 'blood' })),
      spouses: (spousesOf.get(p.id) || []).map(s => ({
        id: s.spouseId,
        type: s.isDivorced ? 'divorced' : 'married',
      })),
      hasSubTree: hasSubTreeSet.has(p.id),
    };
  });

  return { canvas, nodes, connectors };
}
