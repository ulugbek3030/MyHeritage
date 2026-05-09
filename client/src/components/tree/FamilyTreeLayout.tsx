import { useMemo, useRef, useState, useEffect } from 'react';
import calcTree from 'relatives-tree';
import type { ExtNode } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import { PersonCard } from './PersonCard';
import { useZoom } from '../../hooks/useZoom';
import { useDrag } from '../../hooks/useDrag';

// Card grid units. NODE_W/NODE_H = full unit; relatives-tree uses half-units, so cards
// occupy 2 half-units wide. Generous values give breathing room between siblings.
// NODE_W/NODE_H control BOTH the per-card grid step (i.e. spacing between
// siblings/parents) AND the total canvas size. Cards themselves are sized in
// CSS (.pcard width=72, height ≈92). The gap between cards is NODE_W − 72.
const NODE_W = 144;   // spacing between siblings ≈ 72 px
const NODE_H = 184;   // spacing between generations ≈ 92 px
// Empty buffer above the top generation. We render "Add father" / "Add mother"
// placeholders for parentless persons one full generation above their card,
// so this needs at least NODE_H of room to keep them on canvas.
const TOP_PAD = 200;
// Extra room below the bottom generation — same intent as TOP_PAD but for
// kids being added below. 25% is enough breathing room; the canvas grows
// naturally as descendants get added.
const BOTTOM_PAD_RATIO = 0.25;

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
}

export const FamilyTreeLayout = ({ persons, relationships, ownerId, personEventIcons, onPersonClick, onPlusClick, onAddParent }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  // Track real viewport size — re-runs the auto-centre when WebView orientation
  // or chrome height changes.
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const content = useRef<HTMLDivElement>(null);
  // Remember the canvas dimensions we last auto-fit for. When the tree grows
  // (or shrinks) — i.e. someone adds/removes a person — the dims string
  // changes and we re-run fit. Manual zooms between additions stay intact.
  const lastFitDimsRef = useRef<string>('');

  const nodes = useMemo(() => transformToTreeNodes(persons, relationships, ownerId), [persons, relationships, ownerId]);

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
      const personIdSet = new Set(persons.map((p) => p.id));
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
            if (realCount >= persons.length) break;
          }
        } catch { /* root incompatible with calcTree, skip */ }
      }
      return best;
    } catch (e) {
      console.warn('[tree] layout fallback', e);
      return null;
    }
  }, [nodes, ownerId, persons]);

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
    const personIdSet = new Set(persons.map((p) => p.id));
    const phantomBoxes = layout.nodes
      .filter((n) => !personIdSet.has(n.id))
      .map((n) => ({ left: n.left, top: n.top }));
    const inPhantom = (x: number, y: number) =>
      phantomBoxes.some((b) => x >= b.left && x <= b.left + 2 && y >= b.top && y <= b.top + 2);
    const segs = layout.connectors.filter(
      (s) => !(inPhantom(s[0], s[1]) || inPhantom(s[2], s[3]))
    );
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
  }, [layout, persons]);

  const zoom = useZoom(content as React.RefObject<HTMLElement>);
  useDrag(viewport as React.RefObject<HTMLElement>, content as React.RefObject<HTMLElement>);

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
  useEffect(() => {
    if (!layout || !ownerId) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf: number | null = null;
    const tryCentre = () => {
      attempts += 1;
      const vp = viewport.current;
      if (!vp) return;
      const card = vp.querySelector<HTMLElement>(`[data-person-id="${ownerId}"]`);
      if (card && vp.clientWidth && vp.clientHeight) {
        // Re-fit when the canvas changed shape (someone got added/removed).
        // dimsKey also includes viewport size so an orientation change
        // re-fits too. Manual user zooms between additions stay intact —
        // the dimsKey hasn't changed.
        const dimsKey = `${layout.canvas.width}x${layout.canvas.height}@${vp.clientWidth}x${vp.clientHeight}`;
        if (lastFitDimsRef.current !== dimsKey) {
          const W = layout.canvas.width * (NODE_W / 2);
          const H = layout.canvas.height * (NODE_H / 2) + TOP_PAD;
          const fit = Math.min(vp.clientWidth / W, vp.clientHeight / H, 1);
          zoom.setTo(fit < 1 ? fit : 1);
          lastFitDimsRef.current = dimsKey;
        }
        const centreOwner = () => {
          const vpRect = vp.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          vp.scrollLeft += (cardRect.left + cardRect.width / 2) - (vpRect.left + vpRect.width / 2);
          vp.scrollTop  += (cardRect.top  + cardRect.height / 2) - (vpRect.top  + vpRect.height / 2);
        };
        centreOwner();
        raf = requestAnimationFrame(centreOwner);
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
  }, [layout, ownerId, vpSize.w, vpSize.h, zoom]);

  if (!layout) return <div style={{padding:24,color:'var(--text-muted)'}}>Дерево пусто. Добавьте первого родственника.</div>;

  const personById = new Map(persons.map((p) => [p.id, p]));

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
  for (const p of persons) {
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
  // so the rendered box must be NODE_W/2 × NODE_H/2 per half-unit. Spacing
  // and canvas size are now both driven by NODE_W/NODE_H — no extra fudge.
  // We pad the rendered canvas an extra 20% below the bottom generation so
  // there's room to scroll past the lowest cards (helps when adding children).
  const W = canvasW * (NODE_W / 2);
  const layoutH = canvasH * (NODE_H / 2) + TOP_PAD;
  const H = Math.round(layoutH * (1 + BOTTOM_PAD_RATIO));

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
    for (const r of relationships) if (r.category === 'parent_child') hasParent.add(r.person2Id);
    for (const p of persons) if (!hasParent.has(p.id)) parentlessIds.add(p.id);
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
        overflow: 'auto',
        width: '100%',
        height: '100%',
        minHeight: 360,
        cursor: 'grab',
        // Centre the content box when it's smaller than the viewport (e.g. a
        // 1-person tree). `safe` keyword falls back to start-alignment when
        // content overflows, so larger trees stay scrollable instead of
        // getting clipped at top/left.
        display: 'flex',
        justifyContent: 'safe center',
        alignItems: 'safe center',
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
      <div ref={content} style={{ position: 'relative', width: W, height: H, willChange: 'transform' }}>
        <svg width={W} height={H} style={{ position: 'absolute', top: TOP_PAD, left: 0, pointerEvents: 'none' }}>
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
          return (
            <div
              key={n.id}
              data-person-id={n.id}
              style={{
                position: 'absolute',
                transform: `translate(${n.left * (NODE_W / 2)}px, ${n.top * (NODE_H / 2) + TOP_PAD}px)`,
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
            </div>
          );
        })}

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
              const childTopY = e.top * (NODE_H / 2) + TOP_PAD + (NODE_H - 92) / 2;
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
                const parentBottomY = parentInLayout[0].top * (NODE_H / 2) + TOP_PAD + (NODE_H + 92) / 2;
                const barY = parentBottomY + (childTopY - parentBottomY) / 2;
                const sibCenterX = sameRowSib.left * (NODE_W / 2) + NODE_W / 2;
                return (
                  <g key={`extra-conn-${e.id}`}>
                    <line x1={sibCenterX} y1={barY} x2={childCenterX} y2={barY} stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
                    <line x1={childCenterX} y1={barY} x2={childCenterX} y2={childTopY} stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
                  </g>
                );
              }

              if (parentInLayout.length > 0) {
                const parentBottomY = parentInLayout[0].top * (NODE_H / 2) + TOP_PAD + (NODE_H + 92) / 2;
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
          return (
            <div
              key={`extra-${e.id}`}
              data-person-id={e.id}
              style={{
                position: 'absolute',
                transform: `translate(${e.left * (NODE_W / 2)}px, ${e.top * (NODE_H / 2) + TOP_PAD}px)`,
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
            </div>
          );
        })}

        {/* Dashed connectors. Each topRowSlots entry → T-junction down to its
            child. ownerSpouseSlot (when present) → short couple line between
            the existing parent and the placeholder. */}
        {(topRowSlots.length > 0 || ownerSpouseSlot) && (() => {
          const stroke = { stroke: 'rgba(255,255,255,0.3)', strokeWidth: '1.4', strokeDasharray: '3 3' };
          const PLACEHOLDER_H = 82;
          const PERSON_H = 92;
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
              <div
                className="pcard-placeholder"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onAddParent?.(entry.childId, slot.gender); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAddParent?.(entry.childId, slot.gender); } }}
              >
                <span className="pcard-placeholder-plus" aria-hidden="true">+</span>
                <span className="pcard-placeholder-label">Добавить<br />{slot.gender === 'male' ? 'отца' : 'мать'}</span>
              </div>
            </div>
          ))
        )}
        {ownerSpouseSlot && (
          <div
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
            <div
              className="pcard-placeholder"
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); if (ownerId) onAddParent?.(ownerId, ownerSpouseSlot.gender); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (ownerId) onAddParent?.(ownerId, ownerSpouseSlot.gender); } }}
            >
              <span className="pcard-placeholder-plus" aria-hidden="true">+</span>
              <span className="pcard-placeholder-label">Добавить<br />{ownerSpouseSlot.gender === 'male' ? 'отца' : 'мать'}</span>
            </div>
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
  );
};
