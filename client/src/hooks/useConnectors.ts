import { useCallback } from 'react';
import type { Relationship } from '../types';

const LINE_COLOR = '#cbd5e1';
const LINE_WIDTH = 2;
const DIVORCED_DASH = '6,4';


interface ConnectorConfig {
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  relationships: Relationship[];
  generations: { number: number; label: string; personIds: string[] }[];
}

/**
 * Get position of a card element relative to the tree container.
 * Uses offsetLeft/offsetTop chain — immune to CSS scale transforms.
 * Returns: { cx, cy, tx, ty, bx, by }
 *   cx/cy = center, tx/ty = top-center, bx/by = bottom-center
 */
function getPos(el: HTMLElement, container: HTMLElement) {
  let x = 0, y = 0;
  let current: HTMLElement | null = el;
  while (current && current !== container) {
    x += current.offsetLeft;
    y += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return {
    cx: x + w / 2,
    cy: y + h / 2,
    tx: x + w / 2,
    ty: y,
    bx: x + w / 2,
    by: y + h,
  };
}

function createLine(
  svg: SVGSVGElement,
  x1: number, y1: number,
  x2: number, y2: number,
  isDashed = false
) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1.toString());
  line.setAttribute('y1', y1.toString());
  line.setAttribute('x2', x2.toString());
  line.setAttribute('y2', y2.toString());
  line.setAttribute('stroke', LINE_COLOR);
  line.setAttribute('stroke-width', LINE_WIDTH.toString());
  if (isDashed) {
    line.setAttribute('stroke-dasharray', DIVORCED_DASH);
  }
  svg.appendChild(line);
}

/**
 * Draw couple horizontal connection line between two cards.
 * Solid for active couples, dashed for divorced.
 */
function drawCoupleLine(
  container: HTMLElement,
  svg: SVGSVGElement,
  rel: Relationship
) {
  const el1 = container.querySelector(`[data-person-id="${rel.person1Id}"]`) as HTMLElement | null;
  const el2 = container.querySelector(`[data-person-id="${rel.person2Id}"]`) as HTMLElement | null;
  if (!el1 || !el2) return;

  const pos1 = getPos(el1, container);
  const pos2 = getPos(el2, container);
  const isDivorced = rel.coupleStatus === 'divorced';

  // Horizontal line at vertical center of cards
  const y = Math.min(pos1.cy, pos2.cy);
  createLine(svg, pos1.cx, y, pos2.cx, y, isDivorced);
}

/**
 * Draw parent-to-children connection lines.
 * Classic genealogy pattern:
 * - Vertical down from bottom of each parent card
 * - Horizontal parent rail at 30% of gap
 * - Single vertical stem from midpoint of parent rail
 * - Child rail at 70% of gap (if multiple children)
 * - Vertical drops to each child's top-center
 *
 * ALL lines are SOLID. Dashed is ONLY for divorced couple horizontal line.
 */
function drawParentToChildren(
  container: HTMLElement,
  svg: SVGSVGElement,
  parentIds: string[],
  childIds: string[]
) {
  const parentEls = parentIds
    .map(id => container.querySelector(`[data-person-id="${id}"]`) as HTMLElement | null)
    .filter(Boolean) as HTMLElement[];

  const childEls = childIds
    .map(id => container.querySelector(`[data-person-id="${id}"]`) as HTMLElement | null)
    .filter(Boolean) as HTMLElement[];

  if (parentEls.length === 0 || childEls.length === 0) return;

  const parentPositions = parentEls.map(el => getPos(el, container));
  const childPositions = childEls.map(el => getPos(el, container));

  // Parent bottom = max bottom of all parents
  const parentBottom = Math.max(...parentPositions.map(p => p.by));
  // Child top = min top of all children
  const childTop = Math.min(...childPositions.map(c => c.ty));

  // Gap between parent bottom and child top
  const gap = childTop - parentBottom;

  // Parent rail at 30% of gap, child rail at 70% of gap
  const parentRailY = parentBottom + gap * 0.3;
  const childRailY = parentBottom + gap * 0.7;

  // 1. Vertical lines DOWN from bottom of each parent card to parent rail
  for (const pPos of parentPositions) {
    createLine(svg, pPos.bx, pPos.by, pPos.bx, parentRailY);
  }

  const childXs = childPositions.map(c => c.tx);

  // 2. Horizontal parent rail (connecting parent verticals only — never extended)
  if (parentPositions.length >= 2) {
    const leftX = Math.min(...parentPositions.map(p => p.bx));
    const rightX = Math.max(...parentPositions.map(p => p.bx));
    createLine(svg, leftX, parentRailY, rightX, parentRailY);
  }

  // 3. Midpoint of parent rail
  const parentMidX = parentPositions.length >= 2
    ? (parentPositions[0].bx + parentPositions[parentPositions.length - 1].bx) / 2
    : parentPositions[0].bx;

  if (childEls.length === 1) {
    // Single child: same pattern as multiple children but simplified.
    // Vertical stem from parent rail midpoint down to child rail,
    // short horizontal to child X if needed, then vertical drop to child.
    const childX = childXs[0];

    // Vertical stem from parent rail midpoint down to child rail
    createLine(svg, parentMidX, parentRailY, parentMidX, childRailY);

    // Short horizontal from stem to child X (if offset)
    if (Math.abs(parentMidX - childX) > 1) {
      createLine(svg, parentMidX, childRailY, childX, childRailY);
    }

    // Vertical drop to child top
    createLine(svg, childX, childRailY, childX, childPositions[0].ty);
  } else {
    // Multiple children: standard genealogy pattern
    const leftChildX = Math.min(...childXs);
    const rightChildX = Math.max(...childXs);

    // Vertical stem from parent rail midpoint down to child rail
    createLine(svg, parentMidX, parentRailY, parentMidX, childRailY);

    // Horizontal child rail spanning all children
    createLine(svg, leftChildX, childRailY, rightChildX, childRailY);

    // Vertical drops to each child's top-center
    for (let i = 0; i < childPositions.length; i++) {
      createLine(svg, childXs[i], childRailY, childXs[i], childPositions[i].ty);
    }
  }
}

export function useConnectors({
  containerRef,
  svgRef,
  relationships,
  generations,
}: ConnectorConfig) {
  const drawLines = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    // Set SVG size to match container scroll size
    svg.style.width = container.scrollWidth + 'px';
    svg.style.height = container.scrollHeight + 'px';

    // Clear
    svg.innerHTML = '';

    // 1. Draw couple horizontal lines
    for (const rel of relationships) {
      if (rel.category === 'couple') {
        drawCoupleLine(container, svg, rel);
      }
    }

    // 2. Draw parent-to-children lines
    const parentChildRels = relationships.filter(r => r.category === 'parent_child');

    // Find couple relationships for grouping
    const coupleRels = relationships.filter(r => r.category === 'couple');

    // Build: for each person, find their couple partners
    const personCouples = new Map<string, Relationship[]>();
    for (const rel of coupleRels) {
      if (!personCouples.has(rel.person1Id)) personCouples.set(rel.person1Id, []);
      if (!personCouples.has(rel.person2Id)) personCouples.set(rel.person2Id, []);
      personCouples.get(rel.person1Id)!.push(rel);
      personCouples.get(rel.person2Id)!.push(rel);
    }

    // Group parent_child by couple parents
    // Key: sorted parent IDs or single parent ID
    const parentGroups = new Map<string, {
      parents: string[];
      children: string[];
    }>();

    for (const rel of parentChildRels) {
      const parentId = rel.person1Id;
      const childId = rel.person2Id;

      // Check if parent has a partner who is also parent of this child
      const couples = personCouples.get(parentId) || [];
      let groupKey = parentId;
      let parents = [parentId];

      for (const coupleRel of couples) {
        const partnerId = coupleRel.person1Id === parentId ? coupleRel.person2Id : coupleRel.person1Id;
        const partnerIsAlsoParent = parentChildRels.some(
          r => r.person1Id === partnerId && r.person2Id === childId
        );
        if (partnerIsAlsoParent) {
          groupKey = [parentId, partnerId].sort().join('-');
          parents = [parentId, partnerId].sort();
          break;
        }
      }

      if (!parentGroups.has(groupKey)) {
        parentGroups.set(groupKey, { parents, children: [] });
      }
      const group = parentGroups.get(groupKey)!;
      if (!group.children.includes(childId)) {
        group.children.push(childId);
      }
    }

    // Draw lines for each parent group
    // ALL parent-child lines are SOLID (never dashed)
    for (const [, group] of parentGroups) {
      drawParentToChildren(container, svg, group.parents, group.children);
    }
  }, [containerRef, svgRef, relationships, generations]);

  return { drawLines };
}
