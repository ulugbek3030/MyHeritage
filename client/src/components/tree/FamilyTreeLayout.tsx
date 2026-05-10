import { useMemo, useRef, useState, useEffect } from 'react';
import calcTree from 'relatives-tree';
import type { ExtNode } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import { PersonCard } from './PersonCard';
import { usePanZoom } from '../../hooks/usePanZoom';

// Card grid units. NODE_W/NODE_H = full unit; relatives-tree uses half-units, so cards
// occupy 2 half-units wide. Generous values give breathing room between siblings.
// NODE_W/NODE_H control BOTH the per-card grid step (i.e. spacing between
// siblings/parents) AND the total canvas size. Cards themselves are sized in
// CSS (.pcard width=72, height ≈92). The gap between cards is NODE_W − 72.
// All sizes scaled +20% (March 2026 design pass).
const NODE_W = 173;   // spacing between siblings ≈ 86 px
const NODE_H = 221;   // spacing between generations ≈ 110 px
// Card height inside the wrapper — referenced by connector math below.
const CARD_H = 110;
// Empty buffer above the top generation. We render "Add father" / "Add mother"
// placeholders for parentless persons one full generation above their card,
// so this needs at least NODE_H of room to keep them on canvas.
const TOP_PAD = 240;
// Fixed minimum frame size. Owner card sits at the geometric centre of this
// frame; tree content extends from there. Frame grows past these minimums
// when the tree's natural extent doesn't fit.
const LAYOUT_W_MIN = 700;
const LAYOUT_H_MIN = 1400;

interface Props {
  persons: Person[];
  relationships: Relationship[];
  ownerId?: string | null;
  /** Per-person event icons for the current month (e.g. ['🎂','💍']). */
  personEventIcons?: Record<string, string[]>;
  onPersonClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  /** Click on an empty parent slot above a person without parents. */
  onAddParent?: (personId: string, gender: 'male' | 'female') => void;
  /** Click on the collapsed-ancestors pills above a married-in spouse. */
  onDiveSubfamily?: (personId: string) => void;
}

// Dashed-card placeholder with a U-shaped notch at the top so the '+' button
// can sit half-overlapping the card edge — matches the typical "add new"
// affordance in family-tree apps.
const NotchedPlaceholder = ({ gender, onActivate }: { gender: 'male' | 'female'; onActivate: () => void }) => (
  <div
    className="pcard-placeholder"
    role="button"
    tabIndex={0}
    onClick={(e) => { e.stopPropagation(); onActivate(); }}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } }}
  >
    <svg className="pcard-placeholder-notch" viewBox="0 0 60 82" preserveAspectRatio="none">
      <path
        d="M 8 0 L 14 0 A 16 16 0 0 0 46 0 L 52 0 A 8 8 0 0 1 60 8 L 60 74 A 8 8 0 0 1 52 82 L 8 82 A 8 8 0 0 1 0 74 L 0 8 A 8 8 0 0 1 8 0 Z"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
    </svg>
    <span className="pcard-placeholder-plus" aria-hidden="true">+</span>
    <span className="pcard-placeholder-label">Добавить<br />{gender === 'male' ? 'отца' : 'мать'}</span>
  </div>
);

export const FamilyTreeLayout = ({ persons, relationships, ownerId, personEventIcons, onPersonClick, onPlusClick, onAddParent, onDiveSubfamily }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  // Track real viewport size — re-runs the auto-centre when WebView orientation
  // or chrome height changes.
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const content = useRef<HTMLDivElement>(null);
  // Remember the canvas dimensions we last auto-fit for. When the tree grows
  // (or shrinks) — i.e. someone adds/removes a person — the dims string
  // changes and we re-run fit. Manual zooms between additions stay intact.
  const lastFitDimsRef = useRef<string>('');

  // Subfamily collapse: ancestors of married-in spouses are hidden from the
  // owner's tree. Each such spouse gets a small pill above their card; tap on
  // the pill dives into that spouse's parental subfamily on a separate page.
  // mainLineage = owner + ancestors + descendants of those ancestors (i.e.
  // everyone connected to the owner through blood). Couple-partners of
  // lineage who themselves are NOT lineage are "secondaryEntries" — they
  // stay in the layout, but their ancestors fold away.
  const { hidden, secondaryEntries } = useMemo(() => {
    const hide = new Set<string>();
    const secondary = new Set<string>();
    if (!ownerId) return { hidden: hide, secondaryEntries: secondary };

    const lineage = new Set<string>([ownerId]);
    // Ancestors of owner (BFS up via parent_child).
    const upQ: string[] = [ownerId];
    while (upQ.length) {
      const id = upQ.shift()!;
      for (const r of relationships) {
        if (r.category === 'parent_child' && r.person2Id === id && !lineage.has(r.person1Id)) {
          lineage.add(r.person1Id);
          upQ.push(r.person1Id);
        }
      }
    }
    // Descendants of every lineage node — captures siblings of the owner and
    // their children too.
    const downQ: string[] = Array.from(lineage);
    while (downQ.length) {
      const id = downQ.shift()!;
      for (const r of relationships) {
        if (r.category === 'parent_child' && r.person1Id === id && !lineage.has(r.person2Id)) {
          lineage.add(r.person2Id);
          downQ.push(r.person2Id);
        }
      }
    }
    // Couple-partners of lineage who themselves are NOT lineage.
    for (const r of relationships) {
      if (r.category !== 'couple') continue;
      if (lineage.has(r.person1Id) && !lineage.has(r.person2Id)) secondary.add(r.person2Id);
      if (lineage.has(r.person2Id) && !lineage.has(r.person1Id)) secondary.add(r.person1Id);
    }
    // Hidden = ancestors of every secondary entry, plus their other
    // descendants (so siblings of secondaryEntries also fold away).
    const hideAnc = new Set<string>();
    const upHide: string[] = Array.from(secondary);
    while (upHide.length) {
      const id = upHide.shift()!;
      for (const r of relationships) {
        if (r.category === 'parent_child' && r.person2Id === id) {
          const parent = r.person1Id;
          if (!lineage.has(parent) && !secondary.has(parent) && !hideAnc.has(parent)) {
            hideAnc.add(parent);
            upHide.push(parent);
          }
        }
      }
    }
    const downHide: string[] = Array.from(hideAnc);
    while (downHide.length) {
      const id = downHide.shift()!;
      for (const r of relationships) {
        if (r.category === 'parent_child' && r.person1Id === id) {
          const child = r.person2Id;
          if (!lineage.has(child) && !secondary.has(child) && !hideAnc.has(child) && !hide.has(child)) {
            hide.add(child);
            downHide.push(child);
          }
        }
      }
    }
    for (const id of hideAnc) hide.add(id);
    return { hidden: hide, secondaryEntries: secondary };
  }, [ownerId, relationships]);

  const visiblePersons = useMemo(() => persons.filter((p) => !hidden.has(p.id)), [persons, hidden]);
  const visibleRelationships = useMemo(
    () => relationships.filter((r) => !hidden.has(r.person1Id) && !hidden.has(r.person2Id)),
    [relationships, hidden]
  );

  const nodes = useMemo(() => transformToTreeNodes(visiblePersons, visibleRelationships, ownerId), [visiblePersons, visibleRelationships, ownerId]);

  // Owner's existing father/mother. Used to decide which "Add father / Add
  // mother" placeholders to render and where to put them (above the owner
  // when both are missing, next to the existing parent when only one is).
  const ownerParents = useMemo(() => {
    if (!ownerId) return null;
    let fatherId: string | null = null, motherId: string | null = null;
    for (const r of relationships) {
      if (r.category !== 'parent_child' || r.person2Id !== ownerId) continue;
      const parent = persons.find((p) => p.id === r.person1Id);
      if (!parent) continue;
      if (parent.gender === 'male' && !fatherId) fatherId = parent.id;
      else if (parent.gender === 'female' && !motherId) motherId = parent.id;
    }
    return { fatherId, motherId };
  }, [persons, relationships, ownerId]);

  const layout = useMemo(() => {
    if (!nodes.length) return null;
    try {
      // relatives-tree silently drops nodes it can't reach from `rootId`
      // (it doesn't traverse siblings of non-root nodes nor spouse-of-
      // spouse parents). For multi-branch trees that means owner-rooted
      // calcTree skips wife's parents, while shared-child-rooted skips the
      // owner's siblings. We brute-force every person as a root, keep the
      // layout with the most real persons present, and only stop early if
      // one of them lands on the full set.
      // Fast path: if total persons is small enough, this is cheap.
      let best: ReturnType<typeof calcTree> | null = null;
      let bestCount = -1;
      const personIdSet = new Set(visiblePersons.map((p) => p.id));
      const candidates: string[] = [];
      if (ownerId && nodes.some((n) => n.id === ownerId)) candidates.push(ownerId);
      for (const n of nodes) if (n.id !== ownerId) candidates.push(n.id);
      for (const rootId of candidates) {
        try {
          const l = calcTree(nodes as any, { rootId, placeholders: true });
          const realCount = l.nodes.filter((nn) => personIdSet.has(nn.id)).length;
          if (realCount > bestCount) {
            best = l;
            bestCount = realCount;
            if (realCount >= visiblePersons.length) break;
          }
        } catch { /* root incompatible with calcTree, skip */ }
      }
      return best;
    } catch (e) {
      console.warn('[tree] layout fallback', e);
      return null;
    }
  }, [nodes, ownerId, visiblePersons]);

  // Build SVG <path d=...> strings for connectors with rounded corners.
  // Two-pass approach:
  //   1. For each junction with a perpendicular pair, compute ONE radius (min of
  //      half each incident segment's screen length, capped at ARC_R). All segment
  //      shortening AND all arcs at this junction use this exact radius — so the
  //      shortened segment end and the arc's approach point are the same point.
  //   2. Render each segment as a `M L` line shortened by junction[start].r and
  //      junction[end].r where applicable. Then render Q-bezier arcs at each
  //      junction for every perpendicular pair.
  const connectorPaths = useMemo(() => {
    if (!layout) return [] as string[];
    // Drop segments whose endpoints fall inside a phantom node's bounding
    // box. relatives-tree emits couple/parent stubs for its invisible spouse
    // and parent anchors (placeholders=true is required for multi-branch
    // layout but we don't render those nodes), and otherwise they show up
    // as floating dashes around our own "Add father / Add mother" cards.
    const personIdSet = new Set(visiblePersons.map((p) => p.id));
    const phantomBoxes = layout.nodes
      .filter((n) => !personIdSet.has(n.id))
      .map((n) => ({ left: n.left, top: n.top }));
    const inPhantom = (x: number, y: number) =>
      phantomBoxes.some((b) => x >= b.left && x <= b.left + 2 && y >= b.top && y <= b.top + 2);
    // For polygamy kids, suppress relatives-tree's drop into the kid's
    // card-top column (the wrong "from one parent" connector). Our second
    // SVG layer below draws a custom line that joins the couple-line of the
    // kid's parents instead.
    const cc = new Map<string, number>();
    for (const r of relationships) {
      if (r.category !== 'couple') continue;
      cc.set(r.person1Id, (cc.get(r.person1Id) ?? 0) + 1);
      cc.set(r.person2Id, (cc.get(r.person2Id) ?? 0) + 1);
    }
    const suppressBoxes: Array<{ col: number; yMin: number; yMax: number }> = [];
    for (const p of visiblePersons) {
      const parents = relationships
        .filter((r) => r.category === 'parent_child' && r.person2Id === p.id)
        .map((r) => r.person1Id);
      if (parents.length < 2) continue;
      const isPoly = parents.some((id) => (cc.get(id) ?? 0) > 1);
      if (!isPoly) continue;
      const childPos = layout.nodes.find((n) => n.id === p.id);
      if (!childPos) continue;
      const parentTops = parents
        .map((id) => layout.nodes.find((n) => n.id === id))
        .filter(Boolean)
        .map((n) => n!.top);
      const parentTop = parentTops.length ? Math.max(...parentTops) : childPos.top - 2;
      // Range strictly below the parent's card so the couple-line itself
      // (which sits at parent.top + 1) survives.
      suppressBoxes.push({ col: childPos.left + 1, yMin: parentTop + 2, yMax: childPos.top + 0.5 });
      // Also kill stubs at couple-mid X (drop from middle) and at every
      // PARENT'S column (their part of the wrong drop) — without this
      // small stubs dangle below the parents' cards after the rest of the
      // path is removed.
      const parentLefts = parents
        .map((id) => layout.nodes.find((n) => n.id === id))
        .filter(Boolean) as Array<{ left: number; top: number }>;
      for (const par of parentLefts) {
        suppressBoxes.push({ col: par.left + 1, yMin: parentTop + 2, yMax: childPos.top + 0.5 });
      }
      if (parentLefts.length >= 2) {
        const cols = parentLefts.map((n) => n.left + 1);
        const coupleMidCol = (Math.min(...cols) + Math.max(...cols)) / 2;
        suppressBoxes.push({ col: coupleMidCol, yMin: parentTop + 2, yMax: childPos.top + 0.5 });
      }
    }
    const matchesSuppress = (x: number, y: number) =>
      suppressBoxes.some((b) => Math.abs(b.col - x) < 0.5 && y >= b.yMin && y <= b.yMax);
    const segs = layout.connectors.filter((s) => {
      if (inPhantom(s[0], s[1]) || inPhantom(s[2], s[3])) return false;
      if (matchesSuppress(s[0], s[1]) || matchesSuppress(s[2], s[3])) return false;
      return true;
    });
    const sX = NODE_W / 2;
    const sY = NODE_H / 2;
    const ARC_R = 14;
    const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
    type Item = { idx: number; isStart: boolean; far: [number, number] };
    const incident = new Map<string, Item[]>();
    segs.forEach((seg, i) => {
      const k1 = key(seg[0], seg[1]);
      const k2 = key(seg[2], seg[3]);
      if (!incident.has(k1)) incident.set(k1, []);
      if (!incident.has(k2)) incident.set(k2, []);
      incident.get(k1)!.push({ idx: i, isStart: true, far: [seg[2], seg[3]] });
      incident.get(k2)!.push({ idx: i, isStart: false, far: [seg[0], seg[1]] });
    });
    const isPerp = (ax: number, ay: number, bx: number, by: number) => {
      const lenA = Math.hypot(ax, ay);
      const lenB = Math.hypot(bx, by);
      if (lenA < 1e-6 || lenB < 1e-6) return false;
      return Math.abs((ax * bx + ay * by) / (lenA * lenB)) < 0.05;
    };
    const segScreenLen = (idx: number) => {
      const s = segs[idx];
      return Math.hypot((s[2] - s[0]) * sX, (s[3] - s[1]) * sY);
    };
    // Pass 1: determine each junction's radius (only if at least one perp pair exists).
    const junctionR = new Map<string, number>();
    incident.forEach((items, k) => {
      if (items.length < 2) return;
      let hasPerp = false;
      for (let i = 0; i < items.length && !hasPerp; i++) {
        for (let j = i + 1; j < items.length && !hasPerp; j++) {
          const a = items[i];
          const b = items[j];
          const aSeg = segs[a.idx];
          const bSeg = segs[b.idx];
          const aNear = a.isStart ? [aSeg[0], aSeg[1]] : [aSeg[2], aSeg[3]];
          const bNear = b.isStart ? [bSeg[0], bSeg[1]] : [bSeg[2], bSeg[3]];
          if (isPerp(a.far[0] - aNear[0], a.far[1] - aNear[1], b.far[0] - bNear[0], b.far[1] - bNear[1])) {
            hasPerp = true;
          }
        }
      }
      if (!hasPerp) return;
      // r = min(ARC_R, half of shortest incident segment in screen px)
      let minLen = Infinity;
      items.forEach((it) => {
        const len = segScreenLen(it.idx);
        if (len < minLen) minLen = len;
      });
      junctionR.set(k, Math.min(ARC_R, minLen * 0.45));
    });
    const paths: string[] = [];
    // Pass 2a: each segment as a line with ends shortened by the per-junction r.
    segs.forEach((seg, i) => {
      const x1p = seg[0] * sX;
      const y1p = seg[1] * sY;
      const x2p = seg[2] * sX;
      const y2p = seg[3] * sY;
      const dx = x2p - x1p;
      const dy = y2p - y1p;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;
      const ux = dx / len;
      const uy = dy / len;
      const k1 = key(seg[0], seg[1]);
      const k2 = key(seg[2], seg[3]);
      const r1 = junctionR.get(k1) ?? 0;
      const r2 = junctionR.get(k2) ?? 0;
      const sx = x1p + ux * r1;
      const sy = y1p + uy * r1;
      const ex = x2p - ux * r2;
      const ey = y2p - uy * r2;
      paths.push(`M ${sx},${sy} L ${ex},${ey}`);
    });
    // Pass 2b: Q-bezier arc at each junction for every perpendicular pair.
    const drawn = new Set<string>();
    incident.forEach((items, k) => {
      const r = junctionR.get(k);
      if (r === undefined) return;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const aSeg = segs[a.idx];
          const bSeg = segs[b.idx];
          const aNear = a.isStart ? [aSeg[0], aSeg[1]] : [aSeg[2], aSeg[3]];
          const bNear = b.isStart ? [bSeg[0], bSeg[1]] : [bSeg[2], bSeg[3]];
          const aDx = a.far[0] - aNear[0];
          const aDy = a.far[1] - aNear[1];
          const bDx = b.far[0] - bNear[0];
          const bDy = b.far[1] - bNear[1];
          if (!isPerp(aDx, aDy, bDx, bDy)) continue;
          const arcKey = a.idx < b.idx ? `${k}|${a.idx}-${b.idx}` : `${k}|${b.idx}-${a.idx}`;
          if (drawn.has(arcKey)) continue;
          drawn.add(arcKey);
          const jx = aNear[0] * sX;
          const jy = aNear[1] * sY;
          const aDxs = aDx * sX;
          const aDys = aDy * sY;
          const bDxs = bDx * sX;
          const bDys = bDy * sY;
          const lenAs = Math.hypot(aDxs, aDys);
          const lenBs = Math.hypot(bDxs, bDys);
          const apAx = jx + (aDxs / lenAs) * r;
          const apAy = jy + (aDys / lenAs) * r;
          const apBx = jx + (bDxs / lenBs) * r;
          const apBy = jy + (bDys / lenBs) * r;
          paths.push(`M ${apAx},${apAy} Q ${jx},${jy} ${apBx},${apBy}`);
        }
      }
    });
    return paths;
  }, [layout, visiblePersons, relationships]);

  // Transform-based pan + zoom on the frame. No native scroll involved —
  // the viewport (.tree-stage) has overflow:hidden and the frame is moved
  // around inside it via CSS transform. This gives an "infinite canvas"
  // feel: drag works in any direction at any zoom level without bumping a
  // wall, and pinch zoom anchors on the finger midpoint instead of an
  // arbitrary scroll-clamped position.
  const frame = useRef<HTMLDivElement>(null);
  const panZoom = usePanZoom(frame, viewport);

  // Observe the viewport so the auto-centre re-runs when chrome/orientation
  // changes (Click WebView occasionally reflows on first paint).
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const update = () => setVpSize({ w: vp.clientWidth, h: vp.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(update);
    obs.observe(vp);
    return () => obs.disconnect();
  }, []);

  // Auto-fit (zoom out to fit the whole tree) + centre owner card. Runs once
  // per mount (fittedRef gates the fit so subsequent re-renders don't snap
  // the user back). We retry across rAFs because Click's WebView sometimes
  // reports clientWidth/Height as 0 on the first paint.
  // Uses a manual scrollLeft/scrollTop delta on the .tree-stage container
  // instead of card.scrollIntoView — the native call walks the scroll chain
  // and was yanking the page header out of view.
  // Auto-centre on first paint AND every time the canvas changes shape
  // (someone added/removed). usePanZoom.centreOn translates the frame so
  // the given frame-coord lands at the viewport centre — we feed the
  // OWNER's position so the user always sees their own card in the
  // middle. lastFitDimsRef gates re-runs to canvas-shape changes only,
  // so a manual user pan/zoom isn't reset by an unrelated re-render.
  // LEFT_PAD/TOP_OFFSET are computed below in render scope; we recompute
  // them inside the effect from layout to avoid pulling them into hook
  // deps (and to keep this effect above the `if (!layout) return` early
  // return that breaks hook ordering otherwise).
  useEffect(() => {
    if (!layout || !ownerId) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf: number | null = null;
    const tryCentre = () => {
      attempts += 1;
      const vp = viewport.current;
      if (!vp) return;
      if (vp.clientWidth && vp.clientHeight) {
        // Key on canvas dims + node count + raw persons / relationships
        // counts so ANY add / remove re-triggers the auto-fit-centre.
        // canvas dims alone weren't enough — relatives-tree sometimes
        // drops a freshly added person into the "extras" bucket without
        // changing canvas.width/height, so a delete-then-add of the
        // same person produced the same key and skipped the re-centre.
        const dimsKey = [
          layout.canvas.width,
          layout.canvas.height,
          layout.nodes.length,
          persons.length,
          relationships.length,
        ].join('|');
        if (lastFitDimsRef.current !== dimsKey) {
          const ownerNode = layout.nodes.find((n) => n.id === ownerId);
          if (ownerNode) {
            // Recompute frame-coords here so the effect doesn't depend on
            // render-scope variables defined after the early return.
            const ownerCx = ownerNode.left * (NODE_W / 2) + NODE_W / 2;
            const ownerCy = ownerNode.top * (NODE_H / 2) + TOP_PAD + NODE_H / 2;
            const layoutWlocal = layout.canvas.width * (NODE_W / 2);
            const contentHlocal = layout.canvas.height * (NODE_H / 2) + TOP_PAD;
            const halfWlocal = Math.max(LAYOUT_W_MIN / 2, ownerCx, layoutWlocal - ownerCx);
            const halfHlocal = Math.max(LAYOUT_H_MIN / 2, ownerCy, contentHlocal - ownerCy);
            const leftPad = halfWlocal - ownerCx;
            const topOffset = halfHlocal - ownerCy;
            // Owner's position + bbox in frame coords.
            const ownerXInFrame = leftPad + ownerCx;
            const ownerYInFrame = topOffset + ownerCy;
            // Auto-fit + auto-centre: scale picked per-side so the bbox
            // fits in viewport with 40px breathing room, then translated
            // so the OWNER sits ABOVE vp centre (offsetY negative) — this
            // leaves the bulk of the viewport below the owner for the
            // tree to expand into (descendants + spouse + sibling rows).
            // Placeholders for parents still fit above the owner because
            // the per-side fit math computes roomTop accordingly.
            // Owner-centred (not bbox-centred) so the user always sees
            // their own card at the same spot regardless of how the tree
            // skews — descendant-heavy or ancestor-heavy.
            // Owner lift on first paint, two cases:
            //   - Brand-new tree (only the owner): owner sits high enough
            //     that the empty canvas leaves room BELOW for the parent
            //     placeholders and future descendants.
            //   - Anything else: base lift PLUS one CARD_H more, so the
            //     user sees one extra generation row above the viewport's
            //     vertical centre on every reshape.
            // The offsets are MODEST on purpose — earlier values of -380 /
            // -360 made the fit's roomTop go negative for typical phones
            // and the fit fell through to MIN_SCALE (super zoomed out).
            // Keeping |offsetY| comfortably below vp.h/2 preserves real
            // zoom levels.
            const ownerOnly = persons.length === 1;
            const offsetY = ownerOnly ? -180 : -(120 + CARD_H);
            panZoom.fitAndCentreOnOwner(
              ownerXInFrame,
              ownerYInFrame,
              leftPad,
              topOffset,
              leftPad + layoutWlocal,
              topOffset + contentHlocal,
              16,
              offsetY,
            );
          }
          lastFitDimsRef.current = dimsKey;
        }
        return;
      }
      if (attempts < 20) {
        timer = setTimeout(() => { raf = requestAnimationFrame(tryCentre); }, 50);
      }
    };
    raf = requestAnimationFrame(tryCentre);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      if (timer != null) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, ownerId]);

  if (!layout) return <div style={{padding:24,color:'var(--text-muted)'}}>Дерево пусто. Добавьте первого родственника.</div>;

  const personById = new Map(visiblePersons.map((p) => [p.id, p]));

  // Cover the calcTree gap: relatives-tree drops nodes that don't reach
  // through siblings/spouse-parent paths. For each missing real person we
  // infer a slot relative to a related node that DID land in layout.
  // Strategy: prefer a sibling's right side (same row, col +2 in half-units)
  // → fall back to a parent below → spouse adjacent.
  type ExtraNode = { id: string; left: number; top: number; sourceParents?: string[] };
  const layoutById = new Map(layout.nodes.map((n) => [n.id, n]));
  const occupied = new Set(layout.nodes.map((n) => `${n.left},${n.top}`));
  const reserve = (left: number, top: number) => {
    while (occupied.has(`${left},${top}`)) left += 2;
    occupied.add(`${left},${top}`);
    return left;
  };
  const extras: ExtraNode[] = [];
  for (const p of visiblePersons) {
    if (layoutById.has(p.id)) continue;
    const node = nodes.find((n) => n.id === p.id);
    if (!node) continue;
    let placed = false;
    // Sibling on same row.
    for (const sib of node.siblings) {
      const sibPos = layoutById.get(sib.id);
      if (!sibPos) continue;
      const left = reserve(sibPos.left + 2, sibPos.top);
      extras.push({ id: p.id, left, top: sibPos.top, sourceParents: node.parents.map((pp) => pp.id) });
      placed = true;
      break;
    }
    if (placed) continue;
    // Below a parent (one full row down).
    for (const par of node.parents) {
      const parPos = layoutById.get(par.id);
      if (!parPos) continue;
      const left = reserve(parPos.left, parPos.top + 2);
      extras.push({ id: p.id, left, top: parPos.top + 2, sourceParents: node.parents.map((pp) => pp.id) });
      placed = true;
      break;
    }
    if (placed) continue;
    // Adjacent to a spouse.
    for (const sp of node.spouses) {
      const spPos = layoutById.get(sp.id);
      if (!spPos) continue;
      const left = reserve(spPos.left + 2, spPos.top);
      extras.push({ id: p.id, left, top: spPos.top });
      placed = true;
      break;
    }
  }

  // Effective canvas covers BOTH layout-laid and extras.
  let canvasW = layout.canvas.width;
  let canvasH = layout.canvas.height;
  for (const e of extras) {
    canvasW = Math.max(canvasW, e.left + 2);
    canvasH = Math.max(canvasH, e.top + 2);
  }

  // canvas.width/height come back in HALF-units (same scale as node.left/top),
  // so the rendered box must be NODE_W/2 × NODE_H/2 per half-unit.
  const layoutW = canvasW * (NODE_W / 2);
  // Content height includes the TOP_PAD reserved above the topmost card row
  // for "Add father / Add mother" placeholders.
  const contentH = canvasH * (NODE_H / 2) + TOP_PAD;

  // Owner-at-centre frame math (May 2026 spec):
  //   1. The frame is at LEAST LAYOUT_W_MIN × LAYOUT_H_MIN px so even a
  //      brand-new owner-only tree has a generous canvas around it.
  //   2. The frame extends as far past the OWNER as the farthest card on
  //      that side — guarantees no card ever clips off the edge regardless
  //      of how the topology shakes out.
  //   3. Owner card centre lands at exactly (W/2, H/2). LEFT_PAD/TOP_OFFSET
  //      shift the content div inside the frame to make that happen.
  const ownerNode = ownerId ? layout.nodes.find((n) => n.id === ownerId) : undefined;
  const ownerCenterX = ownerNode ? ownerNode.left * (NODE_W / 2) + NODE_W / 2 : layoutW / 2;
  const ownerCenterY = ownerNode ? ownerNode.top * (NODE_H / 2) + TOP_PAD + NODE_H / 2 : contentH / 2;

  const halfW = Math.max(LAYOUT_W_MIN / 2, ownerCenterX, layoutW - ownerCenterX);
  const halfH = Math.max(LAYOUT_H_MIN / 2, ownerCenterY, contentH - ownerCenterY);
  const W = Math.round(halfW * 2);
  const H = Math.round(halfH * 2);
  const LEFT_PAD = Math.round(halfW - ownerCenterX);
  const TOP_OFFSET = Math.round(halfH - ownerCenterY);

  // Two flavours of parent-slot placeholders coexist:
  //   1. "topRow" — one pair (father + mother) above each parentless person
  //      on the topmost parentless row. Lets the user grow ancestry for
  //      anyone visible up there, including their parents-in-law. Each pair
  //      gets a full T-junction down to its child.
  //   2. "ownerSpouse" — when the owner already has one parent (so they
  //      aren't in (1)), a single placeholder is rendered next to the
  //      existing parent in the spouse position with a dashed couple-line.
  //      Lets the owner finish their own parents row without having to dig
  //      into the role-picker.
  type ParentSlot = { gender: 'male' | 'female'; x: number; y: number };
  type TopRowEntry = {
    childId: string;
    childWrapperX: number;
    childWrapperY: number;
    fatherSlot: ParentSlot;
    motherSlot: ParentSlot;
  };

  const parentlessIds = new Set<string>();
  {
    const hasParent = new Set<string>();
    for (const r of visibleRelationships) if (r.category === 'parent_child') hasParent.add(r.person2Id);
    // Married-in spouses (secondaryEntries) deliberately have NO parent slots
    // here — their parents are folded into the pill above their card.
    for (const p of visiblePersons) {
      if (!hasParent.has(p.id) && !secondaryEntries.has(p.id)) parentlessIds.add(p.id);
    }
  }


  let topMostParentlessRow = Infinity;
  for (const n of layout.nodes) {
    if (parentlessIds.has(n.id) && personById.get(n.id) && n.top < topMostParentlessRow) {
      topMostParentlessRow = n.top;
    }
  }

  const topRowSlots: TopRowEntry[] = [];
  for (const n of layout.nodes) {
    if (!parentlessIds.has(n.id) || !personById.get(n.id)) continue;
    if (n.top !== topMostParentlessRow) continue;
    const childWrapperX = n.left * (NODE_W / 2);
    const childWrapperY = n.top * (NODE_H / 2) + TOP_PAD;
    const parentY = childWrapperY - NODE_H;
    topRowSlots.push({
      childId: n.id,
      childWrapperX,
      childWrapperY,
      fatherSlot: { gender: 'male',   x: childWrapperX,                y: parentY },
      motherSlot: { gender: 'female', x: childWrapperX + NODE_W / 2,   y: parentY },
    });
  }

  // Owner-spouse-slot placeholder. Only when owner is NOT already in
  // topRowSlots (i.e. owner already has at least one parent so the topmost
  // parentless row is occupied by someone else).
  let ownerSpouseSlot: ParentSlot | null = null;
  let ownerSpouseExistingId: string | null = null;
  const ownerInTopRow = topRowSlots.some((s) => s.childId === ownerId);
  if (!ownerInTopRow && ownerId && ownerParents) {
    const missingFather = !ownerParents.fatherId;
    const missingMother = !ownerParents.motherId;
    if (missingMother && ownerParents.fatherId) {
      const fNode = layout.nodes.find((n) => n.id === ownerParents.fatherId);
      if (fNode) {
        ownerSpouseSlot = {
          gender: 'female',
          x: fNode.left * (NODE_W / 2) + NODE_W,
          y: fNode.top * (NODE_H / 2) + TOP_PAD,
        };
        ownerSpouseExistingId = ownerParents.fatherId;
      }
    } else if (missingFather && ownerParents.motherId) {
      const mNode = layout.nodes.find((n) => n.id === ownerParents.motherId);
      if (mNode) {
        ownerSpouseSlot = {
          gender: 'male',
          x: mNode.left * (NODE_W / 2) - NODE_W / 2,
          y: mNode.top * (NODE_H / 2) + TOP_PAD,
        };
        ownerSpouseExistingId = ownerParents.motherId;
      }
    }
  }

  return (
    <div
      ref={viewport}
      className="tree-stage"
      style={{
        position: 'relative',
        // Transform-based pan/zoom — no native scroll, frame moves around
        // inside this hidden-overflow viewport via translate+scale.
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        minHeight: 360,
        cursor: 'grab',
      }}
    >
      {(() => {
        try {
          if (!new URL(window.location.href).searchParams.has('debug')) return null;
        } catch { return null; }
        return (
          <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 100, padding: 8, background: 'rgba(0,0,0,0.85)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 9, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--text)', maxWidth: 240, maxHeight: '60vh', overflow: 'auto' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: 4 }}>tree debug</div>
            <div>canvas: {canvasW}×{canvasH}</div>
            <div>layout: {layout.nodes.length} (real {layout.nodes.filter((n) => personById.get(n.id)).length}), extras: {extras.length}</div>
            <div style={{ marginTop: 4, color: '#a78bfa' }}>
              secondary ({secondaryEntries.size}): {Array.from(secondaryEntries).map((id) => persons.find((p) => p.id === id)?.firstName ?? id.slice(0,4)).join(', ') || '∅'}
            </div>
            <div style={{ color: '#f472b6' }}>
              hidden ({hidden.size}): {Array.from(hidden).map((id) => persons.find((p) => p.id === id)?.firstName ?? id.slice(0,4)).join(', ') || '∅'}
            </div>
            <div style={{ marginTop: 4 }}>
              {layout.nodes.map((n) => {
                const p = personById.get(n.id);
                return (
                  <div key={n.id} style={{ color: p ? 'var(--text)' : 'var(--text-muted)' }}>
                    ({n.left},{n.top}) {p ? p.firstName : '·phantom'}
                  </div>
                );
              })}
              {extras.map((e) => (
                <div key={e.id} style={{ color: 'var(--accent)' }}>
                  ({e.left},{e.top}) +{personById.get(e.id)?.firstName}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {/* Frame's CSS box is always W × H px — pinch-zoom only scales the
          content visually via transform on the inner div. tree-stage's scroll
          bounds stay tied to the unscaled frame so user pan room is the
          same regardless of zoom. */}
      <div
        ref={frame}
        style={{
          position: 'relative',
          width: W,
          height: H,
          flexShrink: 0,
        }}
      >
      <div ref={content} style={{ position: 'absolute', top: TOP_OFFSET, left: LEFT_PAD, width: layoutW, height: contentH, willChange: 'transform' }}>
        <svg width={layoutW} height={contentH} style={{ position: 'absolute', top: TOP_PAD, left: 0, pointerEvents: 'none' }}>
          {/* strokeLinecap="butt" — at junctions the segment's shortened end and
              the arc's start share the same point; round caps would double up there
              and render as a small dot. Butt caps are flush. */}
          {connectorPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {layout.nodes.map((n: ExtNode) => {
          const person = personById.get(n.id);
          // Skip placeholder nodes (relatives-tree's spouse/parent anchors with no real Person).
          if (!person) return null;
          const isSecondary = secondaryEntries.has(person.id);
          const wrapX = n.left * (NODE_W / 2);
          const wrapY = n.top * (NODE_H / 2) + TOP_PAD;
          return (
            <div
              key={n.id}
              data-person-id={n.id}
              style={{
                position: 'absolute',
                transform: `translate(${wrapX}px, ${wrapY}px)`,
                width: NODE_W,
                height: NODE_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PersonCard
                person={person}
                isOwner={person.id === ownerId}
                eventIcons={personEventIcons?.[person.id]}
                onClick={onPersonClick}
                onPlusClick={onPlusClick}
                showPlus={true}
              />
              {isSecondary && (
                <button
                  type="button"
                  className="tree-collapsed-pill"
                  aria-label="Открыть семью этого человека"
                  onClick={(e) => { e.stopPropagation(); onDiveSubfamily?.(person.id); }}
                >
                  <span className="tree-collapsed-pill-rect" />
                  <span className="tree-collapsed-pill-bar" />
                  <span className="tree-collapsed-pill-rect" />
                </button>
              )}
            </div>
          );
        })}

        {/* Polygamy second-parent line: from the kid's card-top straight up
            to the couple-line that joins their two parents. Replaces the
            relatives-tree drop (suppressed in connectorPaths above) so the
            kid visually reads as a child of the couple, not just one
            parent. Same visual style as the connectors relatives-tree
            drew for monogamous siblings (Bahrom-style). */}
        {(() => {
          type Seg = { d: string; key: string };
          const segs: Seg[] = [];
          const cc2 = new Map<string, number>();
          for (const r of relationships) {
            if (r.category !== 'couple') continue;
            cc2.set(r.person1Id, (cc2.get(r.person1Id) ?? 0) + 1);
            cc2.set(r.person2Id, (cc2.get(r.person2Id) ?? 0) + 1);
          }
          const layoutNodeMap = new Map(layout.nodes.map((n) => [n.id, n]));
          const extrasMap = new Map(extras.map((e) => [e.id, e]));
          const lookup = (id: string) => layoutNodeMap.get(id) ?? extrasMap.get(id) ?? null;
          for (const p of visiblePersons) {
            const node = nodes.find((n) => n.id === p.id);
            if (!node || node.parents.length < 2) continue;
            const isPoly = node.parents.some((par) => (cc2.get(par.id) ?? 0) > 1);
            if (!isPoly) continue;
            const childPos = lookup(p.id);
            if (!childPos) continue;
            const parentPositions = node.parents
              .map((par) => lookup(par.id))
              .filter(Boolean) as Array<{ left: number; top: number }>;
            if (parentPositions.length < 2) continue;
            const parentCenters = parentPositions.map((pos) => (pos.left + 1) * (NODE_W / 2));
            const couplemidX = (Math.min(...parentCenters) + Math.max(...parentCenters)) / 2;
            // couple-line sits at parent's card mid-Y.
            const lowestParentTop = Math.max(...parentPositions.map((pos) => pos.top));
            const coupleLineY = lowestParentTop * (NODE_H / 2) + TOP_PAD + NODE_H / 2;
            const childCenterX = (childPos.left + 1) * (NODE_W / 2);
            const childTopY = childPos.top * (NODE_H / 2) + TOP_PAD + (NODE_H - CARD_H) / 2;
            const horizSpan = Math.abs(childCenterX - couplemidX);
            let d: string;
            if (horizSpan < 0.5) {
              // Same column → straight vertical drop down to couple-line.
              d = `M ${childCenterX} ${childTopY} L ${childCenterX} ${coupleLineY}`;
            } else {
              // L-shape with rounded corner: child up, then over to
              // couple-mid, then up to couple-line.
              const barY = coupleLineY + (childTopY - coupleLineY) / 2;
              const arcR = Math.min(14, horizSpan / 2, Math.abs(barY - coupleLineY) / 2, Math.abs(barY - childTopY) / 2);
              const dir = couplemidX >= childCenterX ? 1 : -1;
              d =
                `M ${childCenterX} ${childTopY} ` +
                `L ${childCenterX} ${barY + arcR} ` +
                `Q ${childCenterX} ${barY} ${childCenterX + dir * arcR} ${barY} ` +
                `L ${couplemidX - dir * arcR} ${barY} ` +
                `Q ${couplemidX} ${barY} ${couplemidX} ${barY - arcR} ` +
                `L ${couplemidX} ${coupleLineY}`;
            }
            segs.push({ d, key: `pp-${p.id}` });
          }
          if (!segs.length) return null;
          return (
            <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              {segs.map((s) => (
                <path key={s.key} d={s.d} stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" fill="none" strokeLinecap="butt" />
              ))}
            </svg>
          );
        })()}

        {/* Extras: persons relatives-tree dropped from the layout. The
            connector shape depends on which relation the extra was
            anchored to:
              - Sibling in same row → extend the sibling-bar from that
                sibling over to the extra, then drop V to the extra.
                Reads as 'they're hanging from the same parent couple'.
              - Otherwise → simple V from a parent's bottom down. */}
        {extras.length > 0 && (
          <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {extras.map((e) => {
              const node = nodes.find((n) => n.id === e.id);
              if (!node) return null;
              // Multi-parent extras are handled by the rounded T-junction
              // block above (which uses both parents' positions). Drawing
              // the simple single-parent connector here too would duplicate
              // a line — skip it.
              if (node.parents.length >= 2) return null;
              const childTopY = e.top * (NODE_H / 2) + TOP_PAD + (NODE_H - CARD_H) / 2;
              const childCenterX = e.left * (NODE_W / 2) + NODE_W / 2;

              const sibInLayout = node.siblings
                .map((s) => layoutById.get(s.id))
                .filter(Boolean) as Array<{ left: number; top: number }>;
              const sameRowSib = sibInLayout.find((s) => s.top === e.top);
              const parentInLayout = node.parents
                .map((p) => layoutById.get(p.id))
                .filter(Boolean) as Array<{ left: number; top: number }>;

              if (sameRowSib && parentInLayout.length > 0) {
                // Halfway between parents' bottom and child's top — same
                // sibling-bar Y relatives-tree uses internally.
                const parentBottomY = parentInLayout[0].top * (NODE_H / 2) + TOP_PAD + (NODE_H + CARD_H) / 2;
                const barY = parentBottomY + (childTopY - parentBottomY) / 2;
                // Start the bar extension at the couple-midpoint (or single
                // parent's centre) so we don't overlap relatives-tree's own
                // bar segment from couple-mid back to the in-layout sibling.
                const parentCentersX = parentInLayout.map((p) => (p.left + 1) * (NODE_W / 2));
                const startX = parentCentersX.length >= 2
                  ? (Math.min(...parentCentersX) + Math.max(...parentCentersX)) / 2
                  : parentCentersX[0];
                // Single SVG path with a rounded corner — matches the Q-bezier
                // arcs the library draws at every other junction.
                const arcR = Math.min(14, Math.abs(childCenterX - startX) / 2);
                const direction = childCenterX > startX ? 1 : -1;
                const d = `M ${startX} ${barY} L ${childCenterX - direction * arcR} ${barY} Q ${childCenterX} ${barY} ${childCenterX} ${barY + arcR} L ${childCenterX} ${childTopY}`;
                return (
                  <path
                    key={`extra-conn-${e.id}`}
                    d={d}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinecap="butt"
                  />
                );
              }

              if (parentInLayout.length > 0) {
                const parentBottomY = parentInLayout[0].top * (NODE_H / 2) + TOP_PAD + (NODE_H + CARD_H) / 2;
                return (
                  <line key={`extra-conn-${e.id}`}
                    x1={childCenterX} y1={parentBottomY}
                    x2={childCenterX} y2={childTopY}
                    stroke="rgba(255,255,255,0.4)" strokeWidth="1.4"
                  />
                );
              }
              return null;
            })}
          </svg>
        )}
        {extras.map((e) => {
          const person = personById.get(e.id);
          if (!person) return null;
          const isSecondary = secondaryEntries.has(person.id);
          const wrapX = e.left * (NODE_W / 2);
          const wrapY = e.top * (NODE_H / 2) + TOP_PAD;
          return (
            <div
              key={`extra-${e.id}`}
              data-person-id={e.id}
              style={{
                position: 'absolute',
                transform: `translate(${wrapX}px, ${wrapY}px)`,
                width: NODE_W,
                height: NODE_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PersonCard
                person={person}
                isOwner={person.id === ownerId}
                eventIcons={personEventIcons?.[person.id]}
                onClick={onPersonClick}
                onPlusClick={onPlusClick}
                showPlus={true}
              />
              {isSecondary && (
                <button
                  type="button"
                  className="tree-collapsed-pill"
                  aria-label="Открыть семью этого человека"
                  onClick={(ev) => { ev.stopPropagation(); onDiveSubfamily?.(person.id); }}
                >
                  <span className="tree-collapsed-pill-rect" />
                  <span className="tree-collapsed-pill-bar" />
                  <span className="tree-collapsed-pill-rect" />
                </button>
              )}
            </div>
          );
        })}

        {/* Dashed connectors. Each topRowSlots entry → T-junction down to its
            child. ownerSpouseSlot (when present) → short couple line between
            the existing parent and the placeholder. */}
        {(topRowSlots.length > 0 || ownerSpouseSlot) && (() => {
          const stroke = { stroke: 'rgba(255,255,255,0.3)', strokeWidth: '1.4', strokeDasharray: '3 3' };
          const PLACEHOLDER_H = 82;
          const PERSON_H = CARD_H;
          return (
            <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
              {topRowSlots.map((entry) => {
                const childCenterX = entry.childWrapperX + NODE_W / 2;
                const fatherCenterX = entry.fatherSlot.x + NODE_W / 4;
                const motherCenterX = entry.motherSlot.x + NODE_W / 4;
                const parentBottomY = entry.fatherSlot.y + (NODE_H + PLACEHOLDER_H) / 2;
                const childTopY = entry.childWrapperY + (NODE_H - PERSON_H) / 2;
                const stubY = parentBottomY + (childTopY - parentBottomY) / 2;
                return (
                  <g key={`top-conn-${entry.childId}`}>
                    <line x1={fatherCenterX} y1={parentBottomY} x2={fatherCenterX} y2={stubY} {...stroke} />
                    <line x1={motherCenterX} y1={parentBottomY} x2={motherCenterX} y2={stubY} {...stroke} />
                    <line x1={fatherCenterX} y1={stubY} x2={motherCenterX} y2={stubY} {...stroke} />
                    <line x1={childCenterX} y1={stubY} x2={childCenterX} y2={childTopY} {...stroke} />
                  </g>
                );
              })}
              {ownerSpouseSlot && ownerSpouseExistingId && (() => {
                const exNode = layout.nodes.find((n) => n.id === ownerSpouseExistingId);
                if (!exNode) return null;
                const exWrapperX = exNode.left * (NODE_W / 2);
                const exWrapperY = exNode.top * (NODE_H / 2) + TOP_PAD;
                const exCardLeftX  = exWrapperX + (NODE_W - 72) / 2;
                const exCardRightX = exWrapperX + (NODE_W + 72) / 2;
                const phCardLeftX  = ownerSpouseSlot.x + (NODE_W / 2 - 60) / 2;
                const phCardRightX = ownerSpouseSlot.x + (NODE_W / 2 + 60) / 2;
                const coupleY = exWrapperY + NODE_H / 2;
                const placeholderToRight = ownerSpouseSlot.x > exWrapperX;
                const x1 = placeholderToRight ? exCardRightX : phCardRightX;
                const x2 = placeholderToRight ? phCardLeftX  : exCardLeftX;
                return <line key="spouse-conn" x1={x1} y1={coupleY} x2={x2} y2={coupleY} {...stroke} />;
              })()}
            </svg>
          );
        })()}

        {/* Placeholder cards from topRowSlots and ownerSpouseSlot. */}
        {topRowSlots.flatMap((entry) =>
          [entry.fatherSlot, entry.motherSlot].map((slot) => (
            <div
              key={`top-${entry.childId}-${slot.gender}`}
              data-tree-card="placeholder"
              style={{
                position: 'absolute',
                transform: `translate(${slot.x}px, ${slot.y}px)`,
                width: NODE_W / 2,
                height: NODE_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <NotchedPlaceholder
                gender={slot.gender}
                onActivate={() => onAddParent?.(entry.childId, slot.gender)}
              />
            </div>
          ))
        )}
        {ownerSpouseSlot && (
          <div
            data-tree-card="placeholder"
            style={{
              position: 'absolute',
              transform: `translate(${ownerSpouseSlot.x}px, ${ownerSpouseSlot.y}px)`,
              width: NODE_W / 2,
              height: NODE_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NotchedPlaceholder
              gender={ownerSpouseSlot.gender}
              onActivate={() => { if (ownerId) onAddParent?.(ownerId, ownerSpouseSlot.gender); }}
            />
          </div>
        )}

        {/* "Start here" hint — only on a brand-new tree (just the Click-seeded
            owner with both parents missing on the topmost row). */}
        {persons.length === 1 && (() => {
          const ownerEntry = topRowSlots.find((s) => s.childId === ownerId);
          if (!ownerEntry) return null;
          const motherSlot = ownerEntry.motherSlot;
          return (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                transform: `translate(${motherSlot.x + NODE_W / 4}px, ${motherSlot.y + 6}px) translate(-50%, 0)`,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  color: '#0a0a0d',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '4px 9px 4px 8px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 10px rgba(251,191,36,0.45)',
                  animation: 'cf-hint-bob 1.6s ease-in-out infinite',
                }}
              >
                начни отсюда ↓
              </div>
            </div>
          );
        })()}
      </div>
      </div>
    </div>
  );
};
